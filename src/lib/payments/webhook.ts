import crypto from "crypto";
import { db, paymentEvents, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { getGateway, isInboundFailure, InboundPayment, GatewayId } from "./gateway";
import { matchPayment } from "./match";
import { recordPayment } from "@/lib/actions";
import { sendPaymentReceipt } from "@/lib/email/receipts";
import { sendPaymentReceiptSms } from "@/lib/sms/receipts";
import { orgContext } from "@/lib/org";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export type WebhookOutcome =
  | { kind: "rejected"; reason: string }   // caller should return 4xx/ignore
  | { kind: "ignored" }
  | { kind: "duplicate" }
  | { kind: "processed"; status: string };

/**
 * Shared webhook pipeline for all gateways.
 *
 * Ordering is deliberate: the event row is claimed (insert or pending-row
 * update) BEFORE any money is recorded, so a provider retry or a concurrent
 * duplicate delivery can never double-apply a payment — the unique index on
 * (gateway_id, provider_ref) and the conditional status update are the locks.
 */
export async function handleGatewayWebhook(req: Request, gatewayId: GatewayId): Promise<WebhookOutcome> {
  const url = new URL(req.url);
  const orgId = Number(url.searchParams.get("orgId"));
  if (!Number.isInteger(orgId) || orgId <= 0) {
    return { kind: "rejected", reason: "Invalid orgId" };
  }

  const [gatewayConfig] = await db
    .select()
    .from(paymentGateways)
    .where(and(eq(paymentGateways.orgId, orgId), eq(paymentGateways.gatewayId, gatewayId)));

  if (!gatewayConfig || !gatewayConfig.enabled) {
    return { kind: "rejected", reason: "Gateway not configured or disabled" };
  }

  // Daraja has no payload signature — authenticate via the per-org secret
  // token embedded in the callback URL at push time.
  if (gatewayId === "mpesa_daraja") {
    const token = url.searchParams.get("token") || "";
    if (!gatewayConfig.webhookSecret || !timingSafeEqualStr(token, gatewayConfig.webhookSecret)) {
      return { kind: "rejected", reason: "Invalid webhook token" };
    }
  }

  // C2B validation ping: Safaricom asks permission before completing the
  // payment. We accept everything (ResponseType "Completed" is also set at
  // registration); the money event arrives separately via the confirmation.
  if (url.searchParams.get("c2b") === "validation") {
    return { kind: "ignored" };
  }

  const gateway = getGateway(gatewayConfig);

  // parseInbound throws on bad signature (Kopo Kopo HMAC)
  let inbound;
  try {
    inbound = await gateway.parseInbound(req);
  } catch (e: any) {
    return { kind: "rejected", reason: e.message || "Signature verification failed" };
  }

  if (!inbound) return { kind: "ignored" };

  if (isInboundFailure(inbound)) {
    // Customer cancelled / push failed — close the pending event if we have one.
    await db.update(paymentEvents)
      .set({ status: "failed", rawJson: JSON.stringify(inbound.raw) })
      .where(and(
        eq(paymentEvents.orgId, orgId),
        eq(paymentEvents.gatewayId, gatewayId),
        eq(paymentEvents.providerRef, inbound.requestRef),
        eq(paymentEvents.status, "pending"),
      ));
    return { kind: "processed", status: "failed" };
  }

  return orgContext.run(orgId, () => applyInbound(orgId, gatewayId, inbound));
}

async function applyInbound(orgId: number, gatewayId: GatewayId, inbound: InboundPayment): Promise<WebhookOutcome> {
  const direction = inbound.direction ?? "in";
  // 1. Reconcile against a pending STK-push event when we have the request ref.
  //    The conditional UPDATE (status = 'pending') is atomic: only one
  //    concurrent delivery wins the row; losers see zero rows and stop.
  let claimed: { id: number; matchedDocumentId: number | null; amountCents: number } | null = null;
  let pendingAmountCents: number | null = null;

  if (inbound.requestRef) {
    const [row] = await db.update(paymentEvents)
      .set({
        providerRef: inbound.providerRef,
        status: "received",
        payerPhone: inbound.payerPhone,
        payerName: inbound.payerName,
        rawJson: JSON.stringify(inbound.raw),
      })
      .where(and(
        eq(paymentEvents.orgId, orgId),
        eq(paymentEvents.gatewayId, gatewayId),
        eq(paymentEvents.providerRef, inbound.requestRef),
        eq(paymentEvents.status, "pending"),
      ))
      .returning({ id: paymentEvents.id, matchedDocumentId: paymentEvents.matchedDocumentId, amountCents: paymentEvents.amountCents });
    if (row) {
      claimed = row;
      pendingAmountCents = row.amountCents;
    }
  }

  // Payout results must reconcile against a pending event we created at
  // initiation — an unsolicited "payout succeeded" callback is meaningless.
  if (direction === "out" && !claimed) {
    return { kind: "duplicate" };
  }

  // 2. No pending row (unsolicited C2B, or a retry after the pending row was
  //    already consumed) — claim via insert; the unique index rejects dupes.
  if (!claimed) {
    const [row] = await db.insert(paymentEvents)
      .values({
        orgId,
        gatewayId,
        providerRef: inbound.providerRef,
        amountCents: inbound.amountCents,
        payerPhone: inbound.payerPhone,
        payerName: inbound.payerName,
        accountRef: inbound.accountRef,
        status: "received",
        rawJson: JSON.stringify(inbound.raw),
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: [paymentEvents.gatewayId, paymentEvents.providerRef] })
      .returning({ id: paymentEvents.id, matchedDocumentId: paymentEvents.matchedDocumentId, amountCents: paymentEvents.amountCents });
    if (!row) return { kind: "duplicate" };
    claimed = row;
  }

  // 3. Amount check for reconciled STK pushes — never trust the callback blindly.
  //    Because M-Pesa only accepts integers, we requested Math.ceil(pending / 100) * 100.
  //    If the inbound amount perfectly matches either the exact pending amount OR the rounded M-Pesa amount, allow it.
  if (pendingAmountCents !== null) {
    const isExactMatch = pendingAmountCents === inbound.amountCents;
    const isRoundedMatch = gatewayId === "mpesa_daraja" && inbound.amountCents === (Math.ceil(pendingAmountCents / 100) * 100);
    
    if (!isExactMatch && !isRoundedMatch) {
      await db.update(paymentEvents)
        .set({ status: "amount_mismatch", amountCents: inbound.amountCents })
        .where(eq(paymentEvents.id, claimed.id));
      return { kind: "processed", status: "amount_mismatch" };
    }
  }

  // 4. Match: pending rows carry the document they were initiated for.
  //    Auto-matching by phone/ref only makes sense for incoming money.
  const matchedInvoiceId = claimed.matchedDocumentId
    ?? (direction === "in" ? await matchPayment(orgId, inbound) : null);

  if (!matchedInvoiceId) {
    await db.update(paymentEvents).set({ status: "unmatched" }).where(eq(paymentEvents.id, claimed.id));
    return { kind: "processed", status: "unmatched" };
  }

  // 5. Record money last. If this throws, the event row stays 'received'
  //    with the receipt ref — visible for manual review, safe on retry.
  try {
    const paymentId = await recordPayment({
      documentId: matchedInvoiceId,
      amountCents: inbound.amountCents,
      method: gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
      reference: inbound.providerRef,
      date: new Date().toISOString().split("T")[0],
      direction,
    });
    await db.update(paymentEvents)
      .set({ status: "applied", matchedDocumentId: matchedInvoiceId, paymentId })
      .where(eq(paymentEvents.id, claimed.id));
    if (paymentId && direction === "in") {
      await sendPaymentReceipt(paymentId).catch(e => console.error("Receipt failed:", e));
      await sendPaymentReceiptSms(paymentId); // never throws
    }
    return { kind: "processed", status: "applied" };
  } catch (e) {
    console.error("recordPayment failed for event", claimed.id, e);
    await db.update(paymentEvents)
      .set({ status: "failed", matchedDocumentId: matchedInvoiceId })
      .where(eq(paymentEvents.id, claimed.id));
    return { kind: "processed", status: "failed" };
  }
}
