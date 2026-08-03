"use server";

import { db, expenseClaims, accounts, bankAccounts, org, paymentGateways, paymentEvents } from "@/db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { withOrg, currentOrgId, getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { postEntry, mirrorBankTxn, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { ensureAccount } from "@/lib/phase-a-actions";
import { nowISO, todayISO, fmtKES } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { notifyOrg } from "@/lib/notifications";
import { getGateway } from "@/lib/payments/gateway";
import { getOrgSmsConfig, sendSms } from "@/lib/sms";
import { approvalRequestRecipient } from "@/lib/spend-approvals";
import { appOrigin } from "@/lib/receipts/tokens";

async function payableAccountId(): Promise<number> {
  return ensureAccount("2100", "Staff Reimbursements Payable", "liability", "current_liability");
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

export async function reviewedExpenseClaims() {
  return withOrg(() =>
    db.select().from(expenseClaims).where(and(eq(expenseClaims.orgId, currentOrgId()), or(eq(expenseClaims.status, "approved"), eq(expenseClaims.status, "paid")))).orderBy(desc(expenseClaims.createdAt)).limit(50)
  );
}

export async function submitExpenseClaimAction(data: {
  date: string;
  categoryAccountId: number;
  description: string;
  amountCents: number;
  receiptUrl?: string;
}) {
  return withOrg(async () => {
    await requirePerm("expense_claims");
    const access = await getAccess();
    if (!data.description.trim()) throw new Error("Add a short description");
    if (!(data.amountCents > 0)) throw new Error("Amount must be greater than zero");

    const submittedByName = access?.memberName || "Owner";
    await db.insert(expenseClaims).values({
      orgId: currentOrgId(),
      memberId: access?.memberId ?? null,
      submittedByName,
      date: data.date || todayISO(),
      categoryAccountId: data.categoryAccountId,
      description: data.description.trim(),
      amountCents: data.amountCents,
      receiptUrl: data.receiptUrl,
      status: "pending",
      createdAt: nowISO(),
    });

    await notifyOrg(currentOrgId(), ["admin", "accountant"], "New expense claim", `${submittedByName} submitted a claim for ${data.description.trim()}`, "/expense-claims");
    revalidatePath("/expense-claims");
    return { success: true };
  });
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
        reviewedByName: access?.memberName || "Owner",
        journalEntryId: entryId,
        reviewedAt: nowISO(),
      }).where(eq(expenseClaims.id, id));
    } catch (e) {
      await db.update(expenseClaims).set({ status: "pending" }).where(and(eq(expenseClaims.id, id), eq(expenseClaims.status, "approving")));
      throw e;
    }

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

/**
 * Notify the org's approval-request number (same phone bills use for
 * approval SMS) that someone other than an admin/owner is paying out a
 * claim — so an admin always hears about money leaving even when they
 * weren't the one who clicked Pay. Never throws; a missing SMS config or
 * phone just means no notice goes out.
 */
async function sendExpenseClaimPayoutNotice(claim: typeof expenseClaims.$inferSelect, actorName: string) {
  try {
    const [orgRow] = await db.select().from(org).where(eq(org.id, claim.orgId)).limit(1);
    if (!orgRow) return;
    const cfg = await getOrgSmsConfig(claim.orgId);
    if (!cfg) return;
    const recipient = approvalRequestRecipient(orgRow.approvalRequestPhone || orgRow.phone);
    if (!recipient) return;
    const url = `${await appOrigin()}/expense-claims`;
    await sendSms(
      cfg,
      recipient,
      `${orgRow.name || "Zeno"}: ${actorName} is paying out ${claim.submittedByName}'s expense claim for ${fmtKES(claim.amountCents)} (${claim.description}). Review: ${url}`
    );
  } catch {
    // Best-effort notice — never block the actual payout on SMS delivery.
  }
}

/**
 * Pay an approved claim out via a connected payment gateway (M-Pesa/Kopo
 * Kopo) straight to the claimant's phone (or a till/paybill). Mirrors the
 * bill/expense payOutAction flow: money moves once the gateway confirms via
 * webhook (see applyExpenseClaimGatewayPayout), not at request time.
 */
export async function payExpenseClaimGatewayAction(
  id: number,
  destination: string,
  destinationType: "phone" | "till" | "paybill",
  amountCents: number,
  gatewayId: string,
  accountNumber?: string
): Promise<{ success?: true; error?: string }> {
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

      // An accountant paying out (rather than an admin/owner) triggers the
      // admin notice first — the gateway send-money call only happens after.
      // Best-effort: an SMS failure here must never block the actual payout.
      if (access && !access.isOwner && access.role !== "admin") {
        await sendExpenseClaimPayoutNotice(claim, access.memberName || "An accountant").catch((e) => console.error("Payout notice SMS failed:", e));
      }

      const gateway = getGateway(gwConfig);
      const result = await gateway.payOut({
        destination,
        destinationType,
        accountNumber: accountNumber?.trim() || undefined,
        amountCents,
        accountRef: `EXPCLAIM-${claim.id}`,
        payeeName: claim.submittedByName,
        reason: `Reimbursement: ${claim.description}`,
      });

      // Pending outbound event: applyExpenseClaimGatewayPayout (webhook.ts)
      // reconciles against this row once the gateway confirms the transfer.
      await db.insert(paymentEvents).values({
        orgId,
        gatewayId,
        providerRef: result.providerRef,
        direction: "out",
        amountCents,
        payerPhone: destinationType === "phone" ? destination : undefined,
        accountRef: `EXPCLAIM-${claim.id}`,
        status: "pending",
        matchedExpenseClaimId: claim.id,
        rawJson: JSON.stringify({ payoutRef: result.providerRef, destination, destinationType, amountCents }),
        createdAt: new Date().toISOString(),
      }).onConflictDoNothing({ target: [paymentEvents.gatewayId, paymentEvents.providerRef] });

      revalidatePath("/expense-claims");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to process payout" };
  }
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
    const entryId = await postEntry({
      date,
      memo: `Reimbursement paid via ${gatewayId}: ${claim.description} (${claim.submittedByName})`,
      sourceType: "expense_claim_payment",
      sourceId: claim.id,
      lines: [
        { accountId: payable, debitCents: amountCents },
        { accountId: await acct(SYS.UNDEPOSITED), creditCents: amountCents },
      ],
    });

    await db.update(expenseClaims).set({
      status: "paid",
      paidJournalEntryId: entryId,
      paidAt: nowISO(),
    }).where(eq(expenseClaims.id, claimId));

    revalidatePath("/expense-claims");
    return entryId;
  } catch (e) {
    await db.update(expenseClaims).set({ status: "approved" }).where(and(eq(expenseClaims.id, claimId), eq(expenseClaims.status, "paying")));
    throw e;
  }
}
