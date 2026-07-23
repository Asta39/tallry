"use server";

import { db, expenseClaims, accounts, bankAccounts } from "@/db";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { withOrg, currentOrgId, getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { postEntry, mirrorBankTxn } from "@/lib/posting";
import { ensureAccount } from "@/lib/phase-a-actions";
import { nowISO, todayISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { notifyOrg } from "@/lib/notifications";

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
