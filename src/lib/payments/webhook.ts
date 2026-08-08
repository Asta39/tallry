import crypto from "crypto";
import { db, paymentEvents, paymentGateways, documents, bankAccounts, bankTransactions, payments as paymentsTable, expenseClaims, org as orgTable } from "@/db";
import { eq, and } from "drizzle-orm";
import { getGateway, isInboundFailure, InboundPayment, GatewayId } from "./gateway";
import { matchPayment } from "./match";
import { recordPayment } from "@/lib/actions";
import { sendPaymentReceipt } from "@/lib/email/receipts";
import { sendPaymentReceiptSms } from "@/lib/sms/receipts";
import { orgContext, currentOrgId } from "@/lib/org";
import { postEntry, acct, reverseEntry, mirrorBankTxn } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { ensureExpandedChartOfAccounts } from "@/lib/org";
import { notifyAccountantOfPayout } from "@/lib/payout-notify";
import { shortRef } from "@/lib/payments/ref-format";
import { getOrgSmsConfig, sendSms, normalizeKePhone } from "@/lib/sms";
import { fmtKES, todayISO } from "@/lib/money";

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
    const [closedPending] = await db.update(paymentEvents)
      .set({ status: "failed", rawJson: JSON.stringify(inbound.raw) })
      .where(and(
        eq(paymentEvents.orgId, orgId),
        eq(paymentEvents.gatewayId, gatewayId),
        eq(paymentEvents.providerRef, inbound.requestRef),
        eq(paymentEvents.status, "pending"),
      ))
      .returning({ id: paymentEvents.id });
    if (closedPending) return { kind: "processed", status: "failed" };

    // Outbound payouts post immediately at request time (a "send_money
    // accepted" response is not proof the money actually moved — the real
    // outcome only arrives here). If Kopo Kopo/Daraja later reports this
    // exact disbursement failed, the event row is already "applied" and the
    // books already show it paid. Reverse it for real instead of leaving a
    // bill/claim marked paid when the vendor never received anything —
    // this is exactly what "Ref: FE65C1B8 ... but the money never arrived"
    // looks like from the accountant's side.
    if (inbound.requestRef) {
      const [appliedRow] = await db.select().from(paymentEvents).where(and(
        eq(paymentEvents.orgId, orgId),
        eq(paymentEvents.gatewayId, gatewayId),
        eq(paymentEvents.providerRef, inbound.requestRef),
        eq(paymentEvents.status, "applied"),
        eq(paymentEvents.direction, "out"),
      )).limit(1);
      if (appliedRow) {
        await orgContext.run(orgId, () => reverseFailedGatewayPayout(appliedRow, inbound.raw));
        return { kind: "processed", status: "failed" };
      }
    }
    return { kind: "ignored" };
  }

  return orgContext.run(orgId, () => applyInbound(orgId, gatewayId, inbound));
}

async function applyInbound(orgId: number, gatewayId: GatewayId, inbound: InboundPayment): Promise<WebhookOutcome> {
  const direction = inbound.direction ?? "in";
  // 1. Reconcile against a pending STK-push event when we have the request ref.
  //    The conditional UPDATE (status = 'pending') is atomic: only one
  //    concurrent delivery wins the row; losers see zero rows and stop.
  let claimed: { id: number; matchedDocumentId: number | null; matchedExpenseClaimId: number | null; amountCents: number } | null = null;
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
      .returning({ id: paymentEvents.id, matchedDocumentId: paymentEvents.matchedDocumentId, matchedExpenseClaimId: paymentEvents.matchedExpenseClaimId, amountCents: paymentEvents.amountCents });
    if (row) {
      claimed = row;
      pendingAmountCents = row.amountCents;
    }
  }

  // 1b. Outbound payouts are posted immediately at request time (see the
  //     "immediate posting" comments at every payOut() call site) — by the
  //     time this webhook lands, the event row is already 'applied', not
  //     'pending', so the match above never fires for it. What's still
  //     missing at request time is the REAL Kopo Kopo/M-Pesa transaction
  //     code: providerRef was set to Kopo Kopo's internal request id (the
  //     only thing available synchronously), while the actual code the
  //     recipient's SMS shows only arrives here. Swap it in now and re-notify
  //     the accountant with the real code instead of the placeholder one —
  //     nothing about the posted ledger entry changes.
  if (!claimed && direction === "out" && inbound.requestRef) {
    const [applied] = await db.update(paymentEvents)
      .set({ providerRef: inbound.providerRef, rawJson: JSON.stringify(inbound.raw) })
      .where(and(
        eq(paymentEvents.orgId, orgId),
        eq(paymentEvents.gatewayId, gatewayId),
        eq(paymentEvents.providerRef, inbound.requestRef),
        eq(paymentEvents.status, "applied"),
      ))
      .returning({ id: paymentEvents.id, accountRef: paymentEvents.accountRef, amountCents: paymentEvents.amountCents, payerPhone: paymentEvents.payerPhone, paymentId: paymentEvents.paymentId });
    if (applied) {
      // The receipt/payment record was written at request time with the
      // same placeholder ref — swap it for the real code too, so "Ref:" on
      // the payment detail page and PDF receipt matches what's on the
      // vendor's and accountant's phones instead of the internal request id.
      if (applied.paymentId) {
        await db.update(paymentsTable).set({ reference: shortRef(inbound.providerRef) }).where(and(eq(paymentsTable.orgId, orgId), eq(paymentsTable.id, applied.paymentId)));
      }
      await notifyAccountantOfPayout(orgId, {
        label: applied.accountRef || "payout",
        amountCents: applied.amountCents,
        destination: applied.payerPhone || "",
        providerRef: inbound.providerRef,
        gatewayId,
      }).catch(() => null);
      return { kind: "processed", status: "applied" };
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
      .returning({ id: paymentEvents.id, matchedDocumentId: paymentEvents.matchedDocumentId, matchedExpenseClaimId: paymentEvents.matchedExpenseClaimId, amountCents: paymentEvents.amountCents });
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

  // 3b. Expense-claim payouts reconcile against the claim, not a document —
  //     branch off before the invoice-matching logic below, which doesn't apply.
  if (claimed.matchedExpenseClaimId) {
    try {
      const { applyExpenseClaimGatewayPayout } = await import("@/lib/expense-claims");
      const entryId = await applyExpenseClaimGatewayPayout(claimed.matchedExpenseClaimId, claimed.amountCents, gatewayId);
      await db.update(paymentEvents)
        .set({ status: "applied", paymentId: entryId })
        .where(eq(paymentEvents.id, claimed.id));
      return { kind: "processed", status: "applied" };
    } catch (e) {
      console.error("applyExpenseClaimGatewayPayout failed for event", claimed.id, e);
      await db.update(paymentEvents).set({ status: "failed" }).where(eq(paymentEvents.id, claimed.id));
      return { kind: "processed", status: "failed" };
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

    // Both gateways settle into the org's M-Pesa till in practice — without
    // a bankAccountId here, postPayment() falls back to Undeposited Funds,
    // which is why gateway-received/paid-out money was showing up correctly
    // under "Payments Received" (method is set fine) but never landing in
    // the actual 1010 · M-Pesa ledger account.
    const [mpesaBank] = await db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false)))
      .limit(1);

    const paymentId = await recordPayment({
      documentId: matchedInvoiceId,
      amountCents: amountToRecord,
      method: gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
      reference: inbound.providerRef,
      date: new Date().toISOString().split("T")[0],
      direction,
      bankAccountId: mpesaBank?.id,
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
 * Undoes a gateway payout that was posted immediately at request time but
 * later turned out to have actually failed at the provider (disbursement
 * declined/errored, insufficient float, bad destination, etc.) — reverses
 * the journal entry, restores the bill/claim to unpaid, and tells the
 * accountant it needs to be re-sent. Must run inside the paying org's
 * context. Best-effort per side: a reconciled bank line blocks the
 * reversal (same rule voidDocument enforces) rather than corrupting a
 * closed reconciliation — that case is flagged for manual handling instead.
 */
async function reverseFailedGatewayPayout(
  row: typeof paymentEvents.$inferSelect,
  raw: unknown
) {
  const orgId = currentOrgId();
  const date = todayISO();
  let label = row.accountRef || "payout";
  let destination = row.payerPhone || "";
  let reversed = false;
  let manualNote = "";

  try {
    if (row.matchedExpenseClaimId) {
      const [claim] = await db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, orgId), eq(expenseClaims.id, row.matchedExpenseClaimId))).limit(1);
      if (claim && claim.status === "paid" && claim.paidJournalEntryId) {
        await reverseEntry(claim.paidJournalEntryId, date, `Payout failed (Kopo Kopo/M-Pesa declined): ${claim.description}`);
        await db.update(expenseClaims).set({ status: "approved", paidJournalEntryId: null, paidAt: null }).where(eq(expenseClaims.id, claim.id));
        label = `expense claim (${claim.submittedByName})`;
        destination = row.payerPhone || destination;
        reversed = true;
      } else {
        manualNote = "Claim was not in a paid state to reverse — check it manually.";
      }
    } else if (row.matchedDocumentId && row.paymentId) {
      const [payment] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.orgId, orgId), eq(paymentsTable.id, row.paymentId))).limit(1);
      const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, row.matchedDocumentId))).limit(1);
      if (payment?.journalEntryId && doc) {
        const [reconciled] = await db
          .select({ id: bankTransactions.id, reconciliationId: bankTransactions.reconciliationId })
          .from(bankTransactions)
          .where(and(
            eq(bankTransactions.orgId, orgId),
            eq(bankTransactions.journalEntryId, payment.journalEntryId),
          ))
          .limit(1);
        if (reconciled?.reconciliationId) {
          manualNote = "This payment's bank line is already reconciled — reverse it manually after reopening that reconciliation.";
        } else {
          const reversalEntryId = await reverseEntry(payment.journalEntryId, date, `Payout failed (Kopo Kopo/M-Pesa declined): ${doc.number}`);
          const newPaidCents = Math.max(0, doc.paidCents - payment.amountCents);
          const status = newPaidCents >= doc.totalCents ? "paid" : newPaidCents > 0 || doc.creditedCents > 0 ? "partial" : "open";
          await db.update(documents).set({ paidCents: newPaidCents, status }).where(eq(documents.id, doc.id));
          if (payment.bankAccountId) {
            await mirrorBankTxn({
              bankAccountId: payment.bankAccountId,
              date,
              description: `Payout reversed (failed) · ${doc.number}`,
              amountCents: payment.amountCents,
              journalEntryId: reversalEntryId,
              externalRef: `payout_failed:${reversalEntryId}`,
            });
          }
          label = `bill ${doc.number}`;
          destination = row.payerPhone || destination;
          reversed = true;
        }
      } else {
        manualNote = "Could not find the original payment to reverse — check it manually.";
      }
    }
  } catch (e) {
    console.error("reverseFailedGatewayPayout failed for event", row.id, e);
    manualNote = "Automatic reversal failed — check and correct this manually.";
  }

  await db.update(paymentEvents).set({ status: "failed", rawJson: JSON.stringify(raw) }).where(eq(paymentEvents.id, row.id));

  // Distinct from notifyAccountantOfPayout's success template — this is
  // urgent: money the books said was sent was NOT actually delivered.
  try {
    const [orgRow] = await db.select().from(orgTable).where(eq(orgTable.id, orgId)).limit(1);
    if (orgRow?.accountantNotifyPhone) {
      const recipient = normalizeKePhone(orgRow.accountantNotifyPhone);
      const cfg = recipient ? await getOrgSmsConfig(orgId) : null;
      if (recipient && cfg) {
        const suffix = reversed ? "Reversed in the books — please re-send it." : manualNote || "Please check and correct this manually.";
        await sendSms(cfg, recipient, `${orgRow.name || "Zeno"}: PAYOUT FAILED — ${fmtKES(row.amountCents)} for ${label} to ${destination} did NOT go through. ${suffix}`);
      }
    }
  } catch (e) {
    console.error("Failure-notify SMS failed", e);
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
