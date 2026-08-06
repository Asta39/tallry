"use server";

import crypto from "crypto";
import { db, expenseClaims, accounts, bankAccounts, org, paymentGateways, paymentEvents, expenseClaimPayoutApprovals, payments } from "@/db";
import { nextNumber } from "@/lib/actions";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { withOrg, currentOrgId, getOrg, orgContext } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { postEntry, mirrorBankTxn, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { ensureAccount } from "@/lib/phase-a-actions";
import { nowISO, todayISO, fmtKES } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { notifyOrg } from "@/lib/notifications";
import { getGateway, type PaymentGateway } from "@/lib/payments/gateway";
import { getOrgSmsConfig, sendSms } from "@/lib/sms";
import { approvalRequestRecipient } from "@/lib/spend-approvals";
import { appOrigin } from "@/lib/receipts/tokens";
import { logAudit } from "@/lib/audit";
import { notifyAccountantOfPayout } from "@/lib/payout-notify";

const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
function generatePayoutToken(length = 16): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  return out;
}

async function payableAccountId(): Promise<number> {
  return ensureAccount("2100", "Staff Reimbursements Payable", "liability", "current_liability");
}

/** Picks the gateway to use for an automatic expense-claim payout. Orgs with
 *  more than one connected gateway can't have this picked implicitly — honor
 *  org.expenseClaimPayoutGatewayId when it's set and still enabled; only
 *  fall back to "first enabled" when no preference was configured (or that
 *  preferred gateway got disconnected since). */
async function pickExpenseClaimGateway(orgId: number, preferredGatewayId: string | null) {
  if (preferredGatewayId) {
    const [preferred] = await db.select().from(paymentGateways).where(and(
      eq(paymentGateways.orgId, orgId),
      eq(paymentGateways.enabled, true),
      eq(paymentGateways.gatewayId, preferredGatewayId)
    )).limit(1);
    if (preferred) return preferred;
  }
  const [fallback] = await db.select().from(paymentGateways).where(and(eq(paymentGateways.orgId, orgId), eq(paymentGateways.enabled, true))).limit(1);
  return fallback;
}

export async function listExpenseAccounts() {
  return withOrg(() =>
    db.select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.orgId, currentOrgId()), eq(accounts.type, "expense"), eq(accounts.archived, false)))
      .orderBy(accounts.code)
  );
}

export async function myExpenseClaims() {
  return withOrg(async () => {
    const access = await getAccess();
    const orgId = currentOrgId();
    const rows = access?.memberId
      ? await db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, orgId), eq(expenseClaims.memberId, access.memberId))).orderBy(desc(expenseClaims.createdAt))
      : await db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, orgId), isNull(expenseClaims.memberId))).orderBy(desc(expenseClaims.createdAt));
    return rows;
  });
}

export async function pendingExpenseClaims() {
  return withOrg(() =>
    db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, currentOrgId()), eq(expenseClaims.status, "pending"))).orderBy(desc(expenseClaims.createdAt))
  );
}

/** Claim ids currently sitting on an un-decided admin-approval SMS request —
 *  the review UI uses this to hide Approve/Reject and show "Waiting for
 *  admin approval" instead, for anyone but the owner/admin. */
export async function activeAdminApprovalClaimIds() {
  return withOrg(async () => {
    const rows = await db
      .select({ claimId: expenseClaimPayoutApprovals.claimId })
      .from(expenseClaimPayoutApprovals)
      .where(and(
        eq(expenseClaimPayoutApprovals.orgId, currentOrgId()),
        eq(expenseClaimPayoutApprovals.revoked, false),
        isNull(expenseClaimPayoutApprovals.decision),
      ));
    return rows.map((r) => r.claimId);
  });
}

export async function reviewedExpenseClaims() {
  return withOrg(() =>
    db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, currentOrgId()), or(eq(expenseClaims.status, "approved"), eq(expenseClaims.status, "paid")))).orderBy(desc(expenseClaims.createdAt)).limit(50)
  );
}

/** Creates the admin-approval SMS request for an over-limit claim — shared
 *  by submission time (the normal case) and, defensively, anywhere else that
 *  needs to route a claim to the admin. The claim itself stays "pending";
 *  only the owner/admin approving (dashboard or this link) accrues it. */
async function requestAdminApprovalForClaim(
  orgId: number,
  claim: { id: number; amountCents: number; description: string; submittedByName: string; payoutPhone: string | null },
  requestedByName: string,
  limit: number
) {
  const orgRow = await getOrg();
  const recipient = approvalRequestRecipient(orgRow.approvalRequestPhone || orgRow.phone);
  if (!recipient) throw new Error(`This claim exceeds the ${fmtKES(limit)} approval limit, but no approval phone is set — ask your admin to add one in Settings first.`);
  const cfg = await getOrgSmsConfig(orgId);
  if (!cfg) throw new Error(`This claim exceeds the ${fmtKES(limit)} approval limit, but SMS isn't configured for this org — ask your admin to set it up first.`);

  const gwConfig = await pickExpenseClaimGateway(orgId, orgRow.expenseClaimPayoutGatewayId);

  const token = generatePayoutToken();
  await db.insert(expenseClaimPayoutApprovals).values({
    orgId,
    claimId: claim.id,
    token,
    requestedByName,
    destination: claim.payoutPhone || "",
    destinationType: "phone",
    accountNumber: null,
    amountCents: claim.amountCents,
    gatewayId: gwConfig?.gatewayId || "",
    recipient,
    createdAt: nowISO(),
  });

  const url = `${await appOrigin()}/approve/expense-payout/${token}`;
  await sendSms(
    cfg,
    recipient,
    `${orgRow.name || "Zeno"}: ${requestedByName} submitted an expense claim (${fmtKES(claim.amountCents)}, ${claim.description}) — over the ${fmtKES(limit)} limit. Approve: ${url}`
  );

  await logAudit({ action: "request_claim_approval", module: "expense_claims", recordId: claim.id, recordLabel: claim.submittedByName, detail: `${fmtKES(claim.amountCents)} pending admin approval` });
}

export async function submitExpenseClaimAction(data: {
  date: string;
  categoryAccountId: number;
  description: string;
  amountCents: number;
  receiptUrl?: string;
  payoutPhone?: string;
}) {
  return withOrg(async () => {
    await requirePerm("expense_claims");
    const access = await getAccess();
    if (!data.description.trim()) throw new Error("Add a short description");
    if (!(data.amountCents > 0)) throw new Error("Amount must be greater than zero");

    if (!data.categoryAccountId) throw new Error("Select an expense category");
    if (!data.payoutPhone?.trim()) throw new Error("Enter the M-Pesa number to reimburse");

    const orgId = currentOrgId();
    const submittedByName = access?.memberName || "Owner";
    const [claim] = await db.insert(expenseClaims).values({
      orgId,
      memberId: access?.memberId ?? null,
      submittedByName,
      date: data.date || todayISO(),
      categoryAccountId: data.categoryAccountId,
      description: data.description.trim(),
      amountCents: data.amountCents,
      receiptUrl: data.receiptUrl,
      payoutPhone: data.payoutPhone.trim(),
      status: "pending",
      createdAt: nowISO(),
    }).returning();

    // Over-limit claims from anyone but the owner/admin need the admin's
    // sign-off before an accountant can even approve them — routed by SMS
    // right away, at submission, rather than waiting for an accountant to
    // click "Approve" and discover it's blocked.
    const isOwnerOrAdmin = !!access && (access.isOwner || access.role === "admin");
    const limit = (await getOrg()).expenseClaimPayoutLimitCents;
    if (!isOwnerOrAdmin && !!limit && limit > 0 && claim.amountCents > limit) {
      await requestAdminApprovalForClaim(orgId, claim, submittedByName, limit);
    }

    await notifyOrg(orgId, ["admin", "accountant"], "New expense claim", `${submittedByName} submitted a claim for ${data.description.trim()}`, "/expense-claims");
    revalidatePath("/expense-claims");
    return { success: true };
  });
}

/** Post the accrual journal (DR category · CR Staff Reimbursements Payable)
 *  and flip the claim to "approved". Shared by the direct-approve path and
 *  the admin-approval-token path (respondToExpenseClaimPayoutApprovalAction),
 *  since an over-limit claim reaches "approved" via either route. */
async function accrueClaim(claim: typeof expenseClaims.$inferSelect, reviewerName: string): Promise<number> {
  const payable = await payableAccountId();
  const entryId = await postEntry({
    date: todayISO(),
    memo: `Expense claim: ${claim.description} (${claim.submittedByName})`,
    sourceType: "expense_claim",
    sourceId: claim.id,
    lines: [
      { accountId: claim.categoryAccountId, debitCents: claim.amountCents },
      { accountId: payable, creditCents: claim.amountCents },
    ],
  });

  await db.update(expenseClaims).set({
    status: "approved",
    reviewedByName: reviewerName,
    journalEntryId: entryId,
    reviewedAt: nowISO(),
  }).where(eq(expenseClaims.id, claim.id));

  // The claim may have an outstanding admin-approval SMS request (created at
  // submission for an over-limit claim). If it got approved some other way
  // — the admin using the normal dashboard button instead of the SMS link —
  // that request must be revoked, or re-opening the link later shows a
  // broken "approve" screen instead of "already handled".
  await db.update(expenseClaimPayoutApprovals)
    .set({ revoked: true })
    .where(and(eq(expenseClaimPayoutApprovals.claimId, claim.id), eq(expenseClaimPayoutApprovals.revoked, false), isNull(expenseClaimPayoutApprovals.decision)));

  return entryId;
}

/** Best-effort auto-pay right after a claim is accrued: sends the reimbursement
 *  to the claimant's submitted M-Pesa number via the org's configured payout
 *  gateway (or the only enabled one, if it only has one) and posts the cash
 *  leg immediately (see executeGatewayPayoutForClaim). Never throws — a
 *  missing gateway or a failed payout just leaves the claim "approved" so
 *  the accountant can still pay it manually. */
async function tryAutoPayApprovedClaim(orgId: number, claimId: number) {
  const [claim] = await db.select().from(expenseClaims).where(and(eq(expenseClaims.id, claimId), eq(expenseClaims.orgId, orgId))).limit(1);
  if (!claim || claim.status !== "approved" || !claim.payoutPhone) return;

  const orgRow = await getOrg();
  const gwConfig = await pickExpenseClaimGateway(orgId, orgRow.expenseClaimPayoutGatewayId);
  if (!gwConfig) return;

  try {
    const gateway = getGateway(gwConfig);
    await executeGatewayPayoutForClaim(orgId, claim, gateway, gwConfig.gatewayId, claim.payoutPhone, "phone", claim.amountCents, undefined);
  } catch (e) {
    console.error("Auto-pay failed for expense claim", claimId, e);
  }
}

export async function approveExpenseClaimAction(id: number) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const access = await getAccess();
    const orgId = currentOrgId();

    // Atomic claim: two accountants approving simultaneously must not both
    // post the payable journal for the same claim.
    const [claim] = await db
      .update(expenseClaims)
      .set({ status: "approving" })
      .where(and(eq(expenseClaims.id, id), eq(expenseClaims.orgId, orgId), eq(expenseClaims.status, "pending")))
      .returning();
    if (!claim) throw new Error("Claim already reviewed");

    try {
      const orgRow = await getOrg();
      // Accountants (not owner/admin) cannot approve a claim above the org's
      // limit — the SMS approval request was already sent to the admin at
      // submission time (see requestAdminApprovalForClaim); this is just the
      // server-side backstop in case the UI's hidden-button state is bypassed.
      const isAccountantNotAdmin = !!access && !access.isOwner && access.role !== "admin";
      const limit = orgRow.expenseClaimPayoutLimitCents;
      const needsApproval = isAccountantNotAdmin && !!limit && limit > 0 && claim.amountCents > limit;

      if (needsApproval) {
        await db.update(expenseClaims).set({ status: "pending" }).where(eq(expenseClaims.id, id));
        throw new Error(`This claim is over the ${fmtKES(limit)} limit and needs admin approval — it was already sent for approval when submitted.`);
      }

      await accrueClaim(claim, access?.memberName || "Owner");
    } catch (e) {
      await db.update(expenseClaims).set({ status: "pending" }).where(and(eq(expenseClaims.id, id), eq(expenseClaims.status, "approving")));
      throw e;
    }

    // Approval succeeded (accrued) — try to pay it out immediately. This runs
    // outside the try/catch above: a payout failure here must not un-approve
    // an already-accrued claim, it should just leave it "approved" for a
    // manual pay retry.
    await tryAutoPayApprovedClaim(orgId, id);

    revalidatePath("/expense-claims");
    return { success: true };
  });
}

export async function rejectExpenseClaimAction(id: number, note: string) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const access = await getAccess();
    const orgId = currentOrgId();

    const [claim] = await db
      .update(expenseClaims)
      .set({
        status: "rejected",
        reviewedByName: access?.memberName || "Owner",
        reviewNote: note || null,
        reviewedAt: nowISO(),
      })
      .where(and(eq(expenseClaims.id, id), eq(expenseClaims.orgId, orgId), eq(expenseClaims.status, "pending")))
      .returning();
    if (!claim) throw new Error("Claim already reviewed");

    await db.update(expenseClaimPayoutApprovals)
      .set({ revoked: true })
      .where(and(eq(expenseClaimPayoutApprovals.claimId, id), eq(expenseClaimPayoutApprovals.revoked, false), isNull(expenseClaimPayoutApprovals.decision)));

    revalidatePath("/expense-claims");
    return { success: true };
  });
}

/** Pay out an approved claim from a bank/cash account: DR payable · CR bank. */
export async function payExpenseClaimAction(id: number, bankAccountId: number) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    // Atomic claim: two concurrent "Pay" clicks on the same approved claim must
    // not both post a reimbursement — that would pay the employee twice.
    const [claim] = await db
      .update(expenseClaims)
      .set({ status: "paying" })
      .where(and(eq(expenseClaims.id, id), eq(expenseClaims.orgId, orgId), eq(expenseClaims.status, "approved")))
      .returning();
    if (!claim) throw new Error("Only approved claims can be paid");

    try {
      const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, bankAccountId), eq(bankAccounts.orgId, orgId))).limit(1);
      if (!bank) throw new Error("Bank account not found");

      const payable = await payableAccountId();
      const date = todayISO();
      const entryId = await postEntry({
        date,
        memo: `Reimbursement paid: ${claim.description} (${claim.submittedByName})`,
        sourceType: "expense_claim_payment",
        sourceId: claim.id,
        lines: [
          { accountId: payable, debitCents: claim.amountCents },
          { accountId: bank.accountId, creditCents: claim.amountCents },
        ],
      });

      await mirrorBankTxn({
        bankAccountId: bank.id,
        date,
        description: `Reimbursement · ${claim.submittedByName}`,
        amountCents: -claim.amountCents,
        journalEntryId: entryId,
        externalRef: `expclaim:${claim.id}`,
      });

      // Expense claims aren't `documents`, so this row carries no
      // documentId/contactId — the Payments Made screen left-joins those and
      // falls back to the reference text, same as it already does for the
      // payment detail page.
      await db.insert(payments).values({
        orgId,
        number: await nextNumber("payment"),
        direction: "out",
        date,
        amountCents: claim.amountCents,
        method: bank.kind === "mpesa" ? "mpesa" : "bank",
        bankAccountId: bank.id,
        reference: `Expense claim reimbursement · ${claim.submittedByName} · ${claim.description}`,
        journalEntryId: entryId,
        createdAt: nowISO(),
      });

      await db.update(expenseClaims).set({
        status: "paid",
        paidJournalEntryId: entryId,
        bankAccountId: bank.id,
        paidAt: nowISO(),
      }).where(eq(expenseClaims.id, id));
    } catch (e) {
      await db.update(expenseClaims).set({ status: "approved" }).where(and(eq(expenseClaims.id, id), eq(expenseClaims.status, "paying")));
      throw e;
    }

    revalidatePath("/expense-claims");
    revalidatePath("/banking");
    return { success: true };
  });
}

/** Actually calls the gateway and records the pending outbound event — the
 *  one place both the direct-pay path and the admin's approve-then-pay
 *  path call into, so they can never drift out of sync with each other. */
async function executeGatewayPayoutForClaim(
  orgId: number,
  claim: { id: number; submittedByName: string; description: string },
  gateway: PaymentGateway,
  gatewayId: string,
  destination: string,
  destinationType: "phone" | "till" | "paybill",
  amountCents: number,
  accountNumber: string | undefined
) {
  const result = await gateway.payOut({
    destination,
    destinationType,
    accountNumber: accountNumber?.trim() || undefined,
    amountCents,
    accountRef: `EXPCLAIM-${claim.id}`,
    payeeName: claim.submittedByName,
    reason: `Reimbursement: ${claim.description}`,
  });

  // Recorded as already applied and posted immediately below — the
  // accountant needs the ledger balance to move the moment the payout is
  // sent, not whenever the gateway's async webhook callback eventually
  // lands. (If that webhook does arrive later, applyExpenseClaimGatewayPayout
  // will find the claim no longer "approved" and no-op harmlessly.)
  await db.insert(paymentEvents).values({
    orgId,
    gatewayId,
    providerRef: result.providerRef,
    direction: "out",
    amountCents,
    payerPhone: destinationType === "phone" ? destination : undefined,
    accountRef: `EXPCLAIM-${claim.id}`,
    status: "applied",
    matchedExpenseClaimId: claim.id,
    rawJson: JSON.stringify({ payoutRef: result.providerRef, destination, destinationType, amountCents }),
    createdAt: new Date().toISOString(),
  }).onConflictDoNothing({ target: [paymentEvents.gatewayId, paymentEvents.providerRef] });

  await applyExpenseClaimGatewayPayout(claim.id, amountCents, gatewayId);

  await notifyAccountantOfPayout(orgId, {
    label: `expense claim (${claim.submittedByName})`,
    amountCents,
    destination,
    providerRef: result.providerRef,
    gatewayId,
  });
}

/**
 * Pay an approved claim out via a connected payment gateway (M-Pesa/Kopo
 * Kopo) straight to the claimant's phone (or a till/paybill). Mirrors the
 * bill/expense payOutAction flow: money moves once the gateway confirms via
 * webhook (see applyExpenseClaimGatewayPayout), not at request time.
 *
 * If the actor is an accountant (not owner/admin) and the org has set a
 * payout limit that this amount exceeds, the payout is NOT sent — instead
 * an approval request is created and texted to the admin's number, who can
 * approve it (which pays it exactly as requested) or reject it from their
 * phone, no login needed. This is a real gate, not a courtesy notice: the
 * gateway is never called until either the amount clears the limit or an
 * admin approves.
 */
export async function payExpenseClaimGatewayAction(
  id: number,
  destination: string,
  destinationType: "phone" | "till" | "paybill",
  amountCents: number,
  gatewayId: string,
  accountNumber?: string
): Promise<{ success?: true; requiresApproval?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("can_payout");
      const access = await getAccess();
      const orgId = currentOrgId();

      if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Invalid amount");
      if (amountCents % 100 !== 0) throw new Error("Payouts must be a whole shilling amount");
      if (!destination.trim()) throw new Error("Enter a destination");
      if (destinationType === "paybill" && !accountNumber?.trim()) throw new Error("Enter the account number for the receiving paybill");

      const [claim] = await db.select().from(expenseClaims).where(and(eq(expenseClaims.id, id), eq(expenseClaims.orgId, orgId))).limit(1);
      if (!claim) throw new Error("Claim not found");
      if (claim.status !== "approved") throw new Error("Only approved claims can be paid");
      if (amountCents > claim.amountCents) throw new Error("Amount exceeds the claim total");

      const [gwConfig] = await db.select().from(paymentGateways).where(and(
        eq(paymentGateways.orgId, orgId),
        eq(paymentGateways.enabled, true),
        eq(paymentGateways.gatewayId, gatewayId)
      )).limit(1);
      if (!gwConfig) throw new Error("Selected payment gateway is not connected or enabled");

      const orgRow = await getOrg();
      const isAccountantNotAdmin = !!access && !access.isOwner && access.role !== "admin";
      const limit = orgRow.expenseClaimPayoutLimitCents;
      const needsApproval = isAccountantNotAdmin && !!limit && limit > 0 && amountCents > limit;

      if (needsApproval) {
        const recipient = approvalRequestRecipient(orgRow.approvalRequestPhone || orgRow.phone);
        if (!recipient) {
          throw new Error(`This payout needs admin approval (over the ${fmtKES(limit)} limit), but no approval phone is set — add one in Settings first.`);
        }
        const cfg = await getOrgSmsConfig(orgId);
        if (!cfg) {
          throw new Error(`This payout needs admin approval (over the ${fmtKES(limit)} limit), but SMS isn't configured for this org.`);
        }

        const token = generatePayoutToken();
        await db.insert(expenseClaimPayoutApprovals).values({
          orgId,
          claimId: claim.id,
          token,
          requestedByName: access!.memberName || "An accountant",
          destination,
          destinationType,
          accountNumber: accountNumber?.trim() || null,
          amountCents,
          gatewayId,
          recipient,
          createdAt: nowISO(),
        });

        const url = `${await appOrigin()}/approve/expense-payout/${token}`;
        await sendSms(
          cfg,
          recipient,
          `${orgRow.name || "Zeno"}: ${access!.memberName || "An accountant"} wants to pay ${claim.submittedByName}'s expense claim (${fmtKES(amountCents)}, ${claim.description}) — over the ${fmtKES(limit)} limit. Approve: ${url}`
        );

        await logAudit({ action: "request_payout_approval", module: "expense_claims", recordId: claim.id, recordLabel: claim.submittedByName, detail: `${fmtKES(amountCents)} pending admin approval` });
        revalidatePath("/expense-claims");
        return { requiresApproval: true };
      }

      const gateway = getGateway(gwConfig);
      await executeGatewayPayoutForClaim(orgId, claim, gateway, gatewayId, destination, destinationType, amountCents, accountNumber);

      revalidatePath("/expense-claims");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to process payout" };
  }
}

/**
 * Admin (or anyone with the token) approves or rejects a pending expense-
 * claim payout request. Approving executes the exact payout that was
 * originally requested — nothing re-submitted from the click is trusted.
 * No login required (SMS-token flow), matching the bill/expense remote
 * approval pattern.
 */
export async function respondToExpenseClaimPayoutApprovalAction(
  token: string,
  decision: "approved" | "rejected",
  note?: string
): Promise<{ success?: true; error?: string }> {
  try {
    if (!/^[A-Za-z0-9]{10,32}$/.test(token)) throw new Error("Invalid link");

    const [row] = await db.select().from(expenseClaimPayoutApprovals).where(and(eq(expenseClaimPayoutApprovals.token, token), eq(expenseClaimPayoutApprovals.revoked, false))).limit(1);
    if (!row || row.decision) throw new Error("This request has already been handled or is no longer available");

    // No-login token flow: there is no session to resolve the org from, so
    // accrueClaim/postEntry/applyExpenseClaimGatewayPayout (all of which
    // call currentOrgId() internally) would otherwise throw "No organization
    // in context" — explicitly enter the requesting org's context here,
    // same pattern the payment webhook uses for its own no-session calls.
    return await orgContext.run(row.orgId, () => respondInOrgContext(row, decision, note));
  } catch (err: any) {
    return { error: err?.message || "Failed to respond to request" };
  }
}

async function respondInOrgContext(
  row: typeof expenseClaimPayoutApprovals.$inferSelect,
  decision: "approved" | "rejected",
  note?: string
): Promise<{ success?: true; error?: string }> {
  try {
    const [claim] = await db.select().from(expenseClaims).where(eq(expenseClaims.id, row.claimId)).limit(1);
    if (!claim) throw new Error("Claim not found");

    if (decision === "approved") {
      // The claim reaches this point either already "approved" (a payout
      // that itself exceeded the limit, requested from the Pay button), or
      // still "pending" (an over-limit claim whose approval step itself was
      // routed to the admin) — accrue it first in the latter case so a
      // single admin tap both approves and pays.
      if (claim.status === "pending") {
        await accrueClaim(claim, row.requestedByName || "Admin");
      } else if (claim.status !== "approved") {
        throw new Error(`This claim is no longer payable (status: ${claim.status})`);
      }
      const [gwConfig] = await db.select().from(paymentGateways).where(and(
        eq(paymentGateways.orgId, row.orgId),
        eq(paymentGateways.enabled, true),
        eq(paymentGateways.gatewayId, row.gatewayId)
      )).limit(1);
      if (!gwConfig) throw new Error("The payment gateway used for this request is no longer connected or enabled");

      const gateway = getGateway(gwConfig);
      await executeGatewayPayoutForClaim(
        row.orgId,
        claim,
        gateway,
        row.gatewayId,
        row.destination,
        row.destinationType as "phone" | "till" | "paybill",
        row.amountCents,
        row.accountNumber || undefined
      );
    }

    await db.update(expenseClaimPayoutApprovals).set({
      decision,
      note: note?.trim() || null,
      actedAt: nowISO(),
      revoked: true,
    }).where(eq(expenseClaimPayoutApprovals.id, row.id));

    await logAudit({
      action: decision === "approved" ? "approve_payout_request" : "reject_payout_request",
      module: "expense_claims",
      recordId: claim.id,
      recordLabel: claim.submittedByName,
      detail: note?.trim() || undefined,
    });

    revalidatePath("/expense-claims");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to respond to request" };
  }
}

export async function getExpenseClaimPayoutApprovalByToken(token: string) {
  if (!/^[A-Za-z0-9]{10,32}$/.test(token)) return null;
  const [row] = await db
    .select({ approval: expenseClaimPayoutApprovals, claim: expenseClaims, orgRow: org })
    .from(expenseClaimPayoutApprovals)
    .innerJoin(expenseClaims, eq(expenseClaims.id, expenseClaimPayoutApprovals.claimId))
    .innerJoin(org, eq(org.id, expenseClaimPayoutApprovals.orgId))
    .where(and(eq(expenseClaimPayoutApprovals.token, token), eq(expenseClaimPayoutApprovals.revoked, false)))
    .limit(1);
  if (!row || row.approval.decision) return null;
  return row;
}

/**
 * Finalize a gateway payout once the provider confirms it (called from the
 * payment webhook, already running inside the paying org's context): posts
 * DR payable · CR Undeposited Funds (same clearing account bill/expense
 * gateway payouts use when no specific bank was chosen) and marks the claim
 * paid. Atomic claim on status="approving" prevents a duplicate webhook
 * delivery from paying the same claim twice.
 */
export async function applyExpenseClaimGatewayPayout(claimId: number, amountCents: number, gatewayId: string): Promise<number> {
  const orgId = currentOrgId();
  const [claim] = await db
    .update(expenseClaims)
    .set({ status: "paying" })
    .where(and(eq(expenseClaims.id, claimId), eq(expenseClaims.orgId, orgId), eq(expenseClaims.status, "approved")))
    .returning();
  if (!claim) throw new Error("Claim is not payable (already paid or not approved)");

  try {
    const payable = await payableAccountId();
    const date = todayISO();
    // Prefer the org's actual M-Pesa till account over the generic
    // Undeposited Funds clearing account — both gateways settle there in
    // practice, and without this the reimbursement would post correctly by
    // amount but never show up in the real 1010 · M-Pesa ledger.
    const [mpesaBank] = await db
      .select({ id: bankAccounts.id, accountId: bankAccounts.accountId })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false)))
      .limit(1);
    const creditAccountId = mpesaBank?.accountId ?? (await acct(SYS.UNDEPOSITED));
    const entryId = await postEntry({
      date,
      memo: `Reimbursement paid via ${gatewayId}: ${claim.description} (${claim.submittedByName})`,
      sourceType: "expense_claim_payment",
      sourceId: claim.id,
      lines: [
        { accountId: payable, debitCents: amountCents },
        { accountId: creditAccountId, creditCents: amountCents },
      ],
    });

    await db.update(expenseClaims).set({
      status: "paid",
      paidJournalEntryId: entryId,
      paidAt: nowISO(),
    }).where(eq(expenseClaims.id, claimId));

    await db.insert(payments).values({
      orgId,
      number: await nextNumber("payment"),
      direction: "out",
      date,
      amountCents,
      method: "mpesa",
      bankAccountId: mpesaBank?.id,
      reference: `Expense claim reimbursement via ${gatewayId} · ${claim.submittedByName} · ${claim.description}`,
      journalEntryId: entryId,
      createdAt: nowISO(),
    });

    if (mpesaBank) {
      await mirrorBankTxn({
        bankAccountId: mpesaBank.id,
        date,
        description: `Reimbursement · ${claim.submittedByName}`,
        amountCents: -amountCents,
        journalEntryId: entryId,
        externalRef: `expclaim_gw:${claim.id}`,
      });
    }

    revalidatePath("/expense-claims");
    revalidatePath("/banking");
    return entryId;
  } catch (e) {
    await db.update(expenseClaims).set({ status: "approved" }).where(and(eq(expenseClaims.id, claimId), eq(expenseClaims.status, "paying")));
    throw e;
  }
}
