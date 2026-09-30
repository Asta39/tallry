import { db, externalLoans, externalLoanRepayments, accounts, bankAccounts } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { nowISO, fmtKES } from "@/lib/money";
import { postEntry, mirrorBankTxn } from "@/lib/posting";

/*
 * Business borrowings from outside lenders. Plain server library — imported
 * only by the accounting/loans server actions, which do the auth; every
 * function here must run inside orgContext.run() because postEntry() and
 * mirrorBankTxn() resolve the org via AsyncLocalStorage.
 */

/** Where the borrowed money went when the loan was registered:
 *  a bank/M-Pesa account id (post DR bank · CR liability now), or
 *  "already_recorded" (it's already in the books via an opening balance or
 *  manual journal — register it without posting, so the liability isn't
 *  doubled). */
export type LoanReceiptSource = number | "already_recorded";

export function parseReceiptSource(raw: unknown): LoanReceiptSource | null {
  const v = String(raw ?? "").trim();
  if (v === "already_recorded") return "already_recorded";
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

async function orgAccount(orgId: number, id: number) {
  const [a] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, id))).limit(1);
  return a ?? null;
}

async function orgBank(orgId: number, id: number) {
  const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, id))).limit(1);
  return b ?? null;
}

/** Principal still owed: principal − principal part of every repayment. */
export async function externalLoanOutstanding(orgId: number, loanId: number): Promise<number> {
  const [loan] = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, orgId), eq(externalLoans.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  const [row] = await db
    .select({ repaid: sql<number>`coalesce(sum(${externalLoanRepayments.principalCents}), 0)` })
    .from(externalLoanRepayments)
    .where(and(eq(externalLoanRepayments.orgId, orgId), eq(externalLoanRepayments.loanId, loanId)));
  return loan.principalCents - Number(row?.repaid ?? 0);
}

export async function createExternalLoan(params: {
  orgId: number;
  lender: string;
  reference?: string | null;
  liabilityAccountId: number;
  interestAccountId?: number | null;
  principalCents: number;
  startDate: string;
  receivedInto: LoanReceiptSource;
  interestRateBp?: number | null;
  notes?: string | null;
}): Promise<number> {
  const { orgId, receivedInto } = params;
  const lender = params.lender.trim();
  if (!lender) throw new Error("Enter the lender's name");
  if (!Number.isInteger(params.principalCents) || params.principalCents <= 0) throw new Error("Enter the amount borrowed");

  const liability = await orgAccount(orgId, params.liabilityAccountId);
  if (!liability || liability.type !== "liability") throw new Error("Choose a liability account for the loan");
  if (params.interestAccountId) {
    const interest = await orgAccount(orgId, params.interestAccountId);
    if (!interest || interest.type !== "expense") throw new Error("Choose an expense account for interest");
  }
  const bank = receivedInto === "already_recorded" ? null : await orgBank(orgId, receivedInto);
  if (receivedInto !== "already_recorded" && !bank) throw new Error("Bank/M-Pesa account not found");

  const [created] = await db.insert(externalLoans).values({
    orgId,
    lender,
    reference: params.reference?.trim() || null,
    liabilityAccountId: liability.id,
    interestAccountId: params.interestAccountId ?? null,
    principalCents: params.principalCents,
    startDate: params.startDate,
    receivedIntoBankAccountId: bank?.id ?? null,
    interestRateBp: params.interestRateBp ?? null,
    notes: params.notes?.trim() || null,
    status: "active",
    createdAt: nowISO(),
  }).returning();

  if (bank) {
    try {
      const memo = `Loan received · ${lender}${created.reference ? ` · ${created.reference}` : ""}`;
      const entryId = await postEntry({
        date: params.startDate,
        memo,
        sourceType: "external_loan_receipt",
        sourceId: created.id,
        lines: [
          { accountId: bank.accountId, debitCents: params.principalCents },
          { accountId: liability.id, creditCents: params.principalCents },
        ],
      });
      await mirrorBankTxn({
        bankAccountId: bank.id,
        date: params.startDate,
        description: memo,
        amountCents: params.principalCents,
        journalEntryId: entryId,
        externalRef: `extloan:${created.id}`,
      });
      await db.update(externalLoans).set({ receiptJournalEntryId: entryId }).where(eq(externalLoans.id, created.id));
    } catch (e) {
      // e.g. a locked period — don't leave a registered loan with no receipt.
      await db.delete(externalLoans).where(eq(externalLoans.id, created.id));
      throw e;
    }
  }
  return created.id;
}

export async function recordExternalLoanRepayment(params: {
  orgId: number;
  loanId: number;
  date: string;
  principalCents: number;
  interestCents: number;
  interestAccountId?: number | null;
  bankAccountId: number;
  reference?: string | null;
}): Promise<number> {
  const { orgId, loanId, date, principalCents, interestCents } = params;
  if (!Number.isInteger(principalCents) || principalCents < 0) throw new Error("Enter a valid principal amount");
  if (!Number.isInteger(interestCents) || interestCents < 0) throw new Error("Enter a valid interest amount");
  if (principalCents + interestCents <= 0) throw new Error("Enter the principal and/or interest paid");

  const [loan] = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, orgId), eq(externalLoans.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  const outstanding = await externalLoanOutstanding(orgId, loanId);
  if (principalCents > outstanding) {
    throw new Error(`Principal exceeds what's still owed on this loan (${fmtKES(outstanding)})`);
  }

  const bank = await orgBank(orgId, params.bankAccountId);
  if (!bank) throw new Error("Bank/M-Pesa account not found");
  const interestAccountId = params.interestAccountId ?? loan.interestAccountId;
  if (interestCents > 0) {
    if (!interestAccountId) throw new Error("Choose the expense account for the interest");
    const acc = await orgAccount(orgId, interestAccountId);
    if (!acc || acc.type !== "expense") throw new Error("Choose an expense account for the interest");
  }

  const total = principalCents + interestCents;
  const reference = params.reference?.trim() || null;
  const memo = `Loan repayment · ${loan.lender}${reference ? ` · ${reference}` : ""}`;
  const entryId = await postEntry({
    date,
    memo,
    sourceType: "external_loan_repayment",
    sourceId: loanId,
    lines: [
      ...(principalCents > 0 ? [{ accountId: loan.liabilityAccountId, debitCents: principalCents, memo: "Principal" }] : []),
      ...(interestCents > 0 ? [{ accountId: interestAccountId!, debitCents: interestCents, memo: "Interest & charges" }] : []),
      { accountId: bank.accountId, creditCents: total },
    ],
  });
  await mirrorBankTxn({
    bankAccountId: bank.id,
    date,
    description: memo,
    amountCents: -total,
    journalEntryId: entryId,
    externalRef: `extloan-repay:${loanId}:${entryId}`,
  });

  await db.insert(externalLoanRepayments).values({
    orgId,
    loanId,
    date,
    principalCents,
    interestCents,
    interestAccountId: interestCents > 0 ? interestAccountId : null,
    bankAccountId: bank.id,
    reference,
    journalEntryId: entryId,
    createdAt: nowISO(),
  });

  const status = outstanding - principalCents === 0 ? "closed" : "active";
  if (status !== loan.status) {
    await db.update(externalLoans).set({ status }).where(eq(externalLoans.id, loanId));
  }
  return entryId;
}
