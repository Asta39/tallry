import { db, externalLoans, externalLoanRepayments, externalLoanInterestSchedule, accounts, bankAccounts } from "@/db";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { nowISO, fmtKES } from "@/lib/money";
import { postEntry, mirrorBankTxn } from "@/lib/posting";
import { advance, addDays, endOfMonthISO } from "@/lib/recurring";
import { orgContext } from "@/lib/org";

/*
 * Business borrowings from outside lenders. Plain server library, imported
 * only by the accounting/loans server actions (which do the auth) and the
 * daily cron. Every posting function must run inside orgContext.run() —
 * postEntry() and mirrorBankTxn() resolve the org via AsyncLocalStorage.
 *
 * Model (what the accountant asked for):
 * - Outstanding = principal + total interest − payments. The interest is put
 *   on the loan account up front — DR Unexpired Loan Interest (2410, a
 *   contra-liability) · CR loan account — so the loan account shows the full
 *   amount repayable while net liabilities still only carry principal.
 * - The interest is expensed evenly over the term: each month-end
 *   DR interest expense · CR Unexpired Loan Interest.
 * - A payment is one amount that reduces the outstanding: DR loan · CR bank.
 */

export const UNEXPIRED_INTEREST_CODE = "2410";

/** Where the borrowed money went when the loan was registered: a bank/M-Pesa
 *  account id (post DR bank · CR loan account now), or "already_recorded"
 *  (it's already in the books via an opening balance or manual journal —
 *  register it without posting, so the principal isn't doubled). */
export type LoanReceiptSource = number | "already_recorded";

export function parseReceiptSource(raw: unknown): LoanReceiptSource | null {
  const v = String(raw ?? "").trim();
  if (v === "already_recorded") return "already_recorded";
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Even monthly split of `totalCents` over `termMonths`. Month k's interest is
 * expensed at the end of the month in which that loan month closes (a loan
 * from 26 Sep: months close 25 Oct, 25 Nov, … → 31 Oct, 30 Nov, …; from
 * 1 Sep: 30 Sep, 31 Oct, …). The last month absorbs the rounding remainder.
 */
export function interestSchedule(startDate: string, termMonths: number, totalCents: number): { periodEnd: string; amountCents: number }[] {
  if (!Number.isInteger(termMonths) || termMonths <= 0 || totalCents <= 0) return [];
  const each = Math.floor(totalCents / termMonths);
  const rows: { periodEnd: string; amountCents: number }[] = [];
  let cursor = startDate;
  for (let k = 1; k <= termMonths; k++) {
    cursor = advance(cursor, "monthly");
    rows.push({
      periodEnd: endOfMonthISO(addDays(cursor, -1)),
      amountCents: k === termMonths ? totalCents - each * (termMonths - 1) : each,
    });
  }
  return rows;
}

async function orgAccount(orgId: number, id: number) {
  const [a] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, id))).limit(1);
  return a ?? null;
}

async function orgBank(orgId: number, id: number) {
  const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, id))).limit(1);
  return b ?? null;
}

async function unexpiredInterestAccountId(orgId: number): Promise<number> {
  const [existing] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.code, UNEXPIRED_INTEREST_CODE)))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(accounts)
    .values({
      orgId,
      code: UNEXPIRED_INTEREST_CODE,
      name: "Unexpired Loan Interest",
      type: "liability",
      subtype: "current_liability",
      description: "Interest on business loans not yet expensed. Carries a debit balance that offsets the interest included in Loans Payable; released to interest expense month by month.",
      isSystem: true,
    })
    .returning();
  return created.id;
}

/** Still owed: principal + total interest − payments. */
export async function externalLoanOutstanding(orgId: number, loanId: number): Promise<number> {
  const [loan] = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, orgId), eq(externalLoans.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  const [row] = await db
    .select({ paid: sql<number>`coalesce(sum(${externalLoanRepayments.amountCents}), 0)` })
    .from(externalLoanRepayments)
    .where(and(eq(externalLoanRepayments.orgId, orgId), eq(externalLoanRepayments.loanId, loanId)));
  return loan.principalCents + loan.interestTotalCents - Number(row?.paid ?? 0);
}

function validateInterest(interestTotalCents: number, termMonths: number | null | undefined, interestAccountId: number | null | undefined) {
  if (!Number.isInteger(interestTotalCents) || interestTotalCents < 0) throw new Error("Enter a valid interest amount");
  if (interestTotalCents > 0) {
    if (!termMonths || !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 600) {
      throw new Error("Enter the loan term in months to spread the interest over");
    }
    if (!interestAccountId) throw new Error("Choose the interest expense account");
  }
}

/**
 * Adds a loan's interest: puts it on the loan account (dated the loan's start
 * date), writes the monthly schedule, and posts any months already past.
 * Only once per loan.
 */
export async function setupExternalLoanInterest(params: {
  orgId: number;
  loanId: number;
  interestTotalCents: number;
  termMonths: number;
  interestAccountId?: number | null;
  asOf: string;
}): Promise<void> {
  const { orgId, loanId, interestTotalCents, termMonths } = params;
  const [loan] = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, orgId), eq(externalLoans.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  if (loan.interestTotalCents > 0 || loan.interestSetupEntryId) throw new Error("This loan's interest is already set up");
  const interestAccountId = params.interestAccountId ?? loan.interestAccountId;
  validateInterest(interestTotalCents, termMonths, interestAccountId);
  if (interestTotalCents === 0) return;
  const interestAcc = await orgAccount(orgId, interestAccountId!);
  if (!interestAcc || interestAcc.type !== "expense") throw new Error("Choose an expense account for interest");

  const entryId = await postEntry({
    date: loan.startDate,
    memo: `Loan interest over ${termMonths} months · ${loan.lender}`,
    sourceType: "external_loan_interest_setup",
    sourceId: loan.id,
    lines: [
      { accountId: await unexpiredInterestAccountId(orgId), debitCents: interestTotalCents },
      { accountId: loan.liabilityAccountId, creditCents: interestTotalCents },
    ],
  });
  await db
    .update(externalLoans)
    .set({ interestTotalCents, termMonths, interestAccountId: interestAcc.id, interestSetupEntryId: entryId })
    .where(eq(externalLoans.id, loan.id));
  const rows = interestSchedule(loan.startDate, termMonths, interestTotalCents);
  await db.insert(externalLoanInterestSchedule).values(rows.map((r) => ({ orgId, loanId: loan.id, ...r })));
  await postDueLoanInterest(orgId, params.asOf, loan.id);
}

/**
 * Expenses every scheduled month whose periodEnd ≤ asOf and isn't posted yet
 * (optionally for one loan). Each row is claimed first (posted_at set only
 * where still null), so the cron and a manual setup can't double-post it.
 * A month that can't post (e.g. a locked period) is released and reported.
 */
export async function postDueLoanInterest(orgId: number, asOf: string, loanId?: number): Promise<{ posted: number; failed: string[] }> {
  const due = await db
    .select({ row: externalLoanInterestSchedule, loan: externalLoans })
    .from(externalLoanInterestSchedule)
    .innerJoin(externalLoans, eq(externalLoans.id, externalLoanInterestSchedule.loanId))
    .where(
      and(
        eq(externalLoanInterestSchedule.orgId, orgId),
        isNull(externalLoanInterestSchedule.postedAt),
        lte(externalLoanInterestSchedule.periodEnd, asOf),
        ...(loanId ? [eq(externalLoanInterestSchedule.loanId, loanId)] : [])
      )
    )
    .orderBy(externalLoanInterestSchedule.periodEnd);
  if (!due.length) return { posted: 0, failed: [] };
  const unexpired = await unexpiredInterestAccountId(orgId);
  let posted = 0;
  const failed: string[] = [];
  for (const { row, loan } of due) {
    const [claimed] = await db
      .update(externalLoanInterestSchedule)
      .set({ postedAt: nowISO() })
      .where(and(eq(externalLoanInterestSchedule.id, row.id), isNull(externalLoanInterestSchedule.postedAt)))
      .returning({ id: externalLoanInterestSchedule.id });
    if (!claimed) continue;
    try {
      if (!loan.interestAccountId) throw new Error("no interest expense account on the loan");
      const entryId = await postEntry({
        date: row.periodEnd,
        memo: `Loan interest for ${row.periodEnd.slice(0, 7)} · ${loan.lender}`,
        sourceType: "external_loan_interest",
        sourceId: loan.id,
        lines: [
          { accountId: loan.interestAccountId, debitCents: row.amountCents },
          { accountId: unexpired, creditCents: row.amountCents },
        ],
      });
      await db.update(externalLoanInterestSchedule).set({ journalEntryId: entryId }).where(eq(externalLoanInterestSchedule.id, row.id));
      posted++;
    } catch (e) {
      await db.update(externalLoanInterestSchedule).set({ postedAt: null }).where(eq(externalLoanInterestSchedule.id, row.id));
      failed.push(`${loan.lender} ${row.periodEnd}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { posted, failed };
}

/** Daily cron: post due interest for every org that has any. */
export async function postDueLoanInterestAllOrgs(asOf: string) {
  const orgs = await db
    .selectDistinct({ orgId: externalLoanInterestSchedule.orgId })
    .from(externalLoanInterestSchedule)
    .where(and(isNull(externalLoanInterestSchedule.postedAt), lte(externalLoanInterestSchedule.periodEnd, asOf)));
  let posted = 0;
  const failed: string[] = [];
  for (const { orgId } of orgs) {
    const r = await orgContext.run(orgId, () => postDueLoanInterest(orgId, asOf));
    posted += r.posted;
    failed.push(...r.failed.map((f) => `org ${orgId}: ${f}`));
  }
  return { posted, failed };
}

export async function createExternalLoan(params: {
  orgId: number;
  lender: string;
  reference?: string | null;
  liabilityAccountId: number;
  interestAccountId?: number | null;
  principalCents: number;
  interestTotalCents?: number;
  termMonths?: number | null;
  startDate: string;
  receivedInto: LoanReceiptSource;
  interestRateBp?: number | null;
  notes?: string | null;
  asOf: string;
}): Promise<number> {
  const { orgId, receivedInto } = params;
  const interestTotalCents = params.interestTotalCents ?? 0;
  const lender = params.lender.trim();
  if (!lender) throw new Error("Enter the lender's name");
  if (!Number.isInteger(params.principalCents) || params.principalCents <= 0) throw new Error("Enter the amount borrowed");
  validateInterest(interestTotalCents, params.termMonths, params.interestAccountId);

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
    termMonths: params.termMonths ?? null,
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

  if (interestTotalCents > 0) {
    await setupExternalLoanInterest({
      orgId,
      loanId: created.id,
      interestTotalCents,
      termMonths: params.termMonths!,
      interestAccountId: params.interestAccountId,
      asOf: params.asOf,
    });
  }
  return created.id;
}

export async function recordExternalLoanRepayment(params: {
  orgId: number;
  loanId: number;
  date: string;
  amountCents: number;
  bankAccountId: number;
  reference?: string | null;
}): Promise<number> {
  const { orgId, loanId, date, amountCents } = params;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Enter the amount paid");

  const [loan] = await db.select().from(externalLoans).where(and(eq(externalLoans.orgId, orgId), eq(externalLoans.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  const outstanding = await externalLoanOutstanding(orgId, loanId);
  if (amountCents > outstanding) throw new Error(`That's more than is still owed on this loan (${fmtKES(outstanding)})`);

  const bank = await orgBank(orgId, params.bankAccountId);
  if (!bank) throw new Error("Bank/M-Pesa account not found");

  const reference = params.reference?.trim() || null;
  const memo = `Loan repayment · ${loan.lender}${reference ? ` · ${reference}` : ""}`;
  const entryId = await postEntry({
    date,
    memo,
    sourceType: "external_loan_repayment",
    sourceId: loanId,
    lines: [
      { accountId: loan.liabilityAccountId, debitCents: amountCents },
      { accountId: bank.accountId, creditCents: amountCents },
    ],
  });
  await mirrorBankTxn({
    bankAccountId: bank.id,
    date,
    description: memo,
    amountCents: -amountCents,
    journalEntryId: entryId,
    externalRef: `extloan-repay:${loanId}:${entryId}`,
  });

  await db.insert(externalLoanRepayments).values({
    orgId,
    loanId,
    date,
    amountCents,
    bankAccountId: bank.id,
    reference,
    journalEntryId: entryId,
    createdAt: nowISO(),
  });

  const status = outstanding - amountCents === 0 ? "closed" : "active";
  if (status !== loan.status) {
    await db.update(externalLoans).set({ status }).where(eq(externalLoans.id, loanId));
  }
  return entryId;
}
