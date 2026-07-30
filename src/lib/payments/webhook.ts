import crypto from "crypto";
import { db, paymentEvents, paymentGateways, documents } from "@/db";
import { eq, and } from "drizzle-orm";
import { getGateway, isInboundFailure, InboundPayment, GatewayId } from "./gateway";
import { matchPayment } from "./match";
import { recordPayment } from "@/lib/actions";
import { sendPaymentReceipt } from "@/lib/email/receipts";
import { sendPaymentReceiptSms } from "@/lib/sms/receipts";
import { orgContext } from "@/lib/org";
import { postEntry, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { ensureExpandedChartOfAccounts } from "@/lib/org";

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
  //    M-Pesa only moves whole shillings, so an invoice with cents is pushed as
  //    Math.ceil(pending / 100) * 100 and comes back rounded. That applies to
  //    Kopo Kopo too, since it rides on M-Pesa and rounds identically — scoping
  //    this escape to Daraja alone left every Kopo Kopo payment on an invoice
  //    with cents stuck in amount_mismatch, never marked paid.
  if (pendingAmountCents !== null) {
    const isExactMatch = pendingAmountCents === inbound.amountCents;
    const isRoundedMatch = inbound.amountCents === Math.ceil(pendingAmountCents / 100) * 100;


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
    // Mobile money moves whole shillings only; an invoice total with cents
    // (VAT math routinely produces them) can never be paid exactly through
    // M-Pesa/Kopo Kopo. Recording the raw received amount leaves a stray few
    // cents owed either way forever — record exactly the invoice's true
    // balance instead, and absorb the small difference as a rounding entry so
    // the customer's balance lands at precisely zero.
    let amountToRecord = inbound.amountCents;
    if (direction === "in") {
      const [doc] = await db
        .select({ totalCents: documents.totalCents, paidCents: documents.paidCents, creditedCents: documents.creditedCents })
        .from(documents)
        .where(and(eq(documents.orgId, orgId), eq(documents.id, matchedInvoiceId)))
        .limit(1);
      if (doc) {
        const balanceCents = doc.totalCents - doc.paidCents - doc.creditedCents;
        const diff = inbound.amountCents - balanceCents;
        // Cap at 99 cents — a whole-shilling rounding artifact is at most
        // that; anything larger is a real under/overpayment and must show up
        // as a genuine balance, not be silently written off.
        if (diff !== 0 && Math.abs(diff) < 100) {
          amountToRecord = balanceCents;
          await absorbRounding(orgId, diff, new Date().toISOString().split("T")[0], inbound.providerRef);
        }
      }
    }

    const paymentId = await recordPayment({
      documentId: matchedInvoiceId,
      amountCents: amountToRecord,
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

/**
 * Posts a whole-shilling rounding difference to the Rounding Adjustments
 * income account, offset against Undeposited Funds — the same account
 * postPayment() debits/credits for gateway-received cash, so Undeposited
 * Funds still ends up holding exactly what was actually received even though
 * the amount applied to the invoice itself was rounded to the true balance.
 *
 * diff > 0: customer's mobile-money payment rounded up past the balance due
 *           (extra cash in, small gain).
 * diff < 0: rounded down short of the balance due (small shortfall).
 */
async function absorbRounding(orgId: number, diffCents: number, date: string, providerRef: string) {
  // Called from within applyInbound, which already runs inside this org's
  // orgContext — currentOrgId() below resolves correctly without re-entering it.
  let roundingAccountId: number;
  try {
    roundingAccountId = await acct(SYS.ROUNDING);
  } catch {
    // Org predates this account being added to the seed chart — provision it
    // on the fly rather than losing the rounding write-off.
    await ensureExpandedChartOfAccounts(orgId);
    roundingAccountId = await acct(SYS.ROUNDING);
  }
  const undepositedId = await acct(SYS.UNDEPOSITED);
  const amount = Math.abs(diffCents);
  await postEntry({
    date,
    memo: `Rounding adjustment — ${providerRef}`,
    sourceType: "rounding_adjustment",
    lines:
      diffCents > 0
        ? [
            { accountId: undepositedId, debitCents: amount },
            { accountId: roundingAccountId, creditCents: amount },
          ]
        : [
            { accountId: roundingAccountId, debitCents: amount },
            { accountId: undepositedId, creditCents: amount },
          ],
  });
}
