import { db, accounts, bankAccounts, externalLoans, externalLoanRepayments, externalLoanInterestSchedule, journalLines } from "@/db";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

/** Shared lookups for the Business Loans pages. */
export async function loanFormOptions(orgId: number) {
  const [accs, banks] = await Promise.all([
    db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.archived, false), inArray(accounts.type, ["liability", "expense"])))
      .orderBy(accounts.code),
    db
      .select({ id: bankAccounts.id, name: bankAccounts.name })
      .from(bankAccounts)
      .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.archived, false))),
  ]);
  const liabilityAccounts = accs.filter((a) => a.type === "liability");
  const interestAccounts = accs.filter((a) => a.type === "expense");
  const defaultLiabilityId =
    liabilityAccounts.find((a) => a.code === "2400")?.id ??
    liabilityAccounts.find((a) => /loan/i.test(a.name))?.id ??
    null;
  const defaultInterestId =
    interestAccounts.find((a) => /interest on loan/i.test(a.name))?.id ??
    interestAccounts.find((a) => a.code === "6075")?.id ??
    interestAccounts.find((a) => /interest/i.test(a.name))?.id ??
    null;
  return { liabilityAccounts, interestAccounts, bankAccounts: banks, defaultLiabilityId, defaultInterestId };
}

/** Every loan with what's been paid, interest expensed so far, and the
 *  outstanding balance (principal + total interest − payments). */
export async function loansWithBalances(orgId: number) {
  const loans = await db.select().from(externalLoans).where(eq(externalLoans.orgId, orgId)).orderBy(externalLoans.startDate);
  const [paidRows, expensedRows] = await Promise.all([
    db
      .select({ loanId: externalLoanRepayments.loanId, paid: sql<number>`coalesce(sum(${externalLoanRepayments.amountCents}), 0)` })
      .from(externalLoanRepayments)
      .where(eq(externalLoanRepayments.orgId, orgId))
      .groupBy(externalLoanRepayments.loanId),
    db
      .select({ loanId: externalLoanInterestSchedule.loanId, expensed: sql<number>`coalesce(sum(${externalLoanInterestSchedule.amountCents}), 0)` })
      .from(externalLoanInterestSchedule)
      .where(and(eq(externalLoanInterestSchedule.orgId, orgId), isNotNull(externalLoanInterestSchedule.journalEntryId)))
      .groupBy(externalLoanInterestSchedule.loanId),
  ]);
  const paid = new Map(paidRows.map((r) => [r.loanId, Number(r.paid)]));
  const expensed = new Map(expensedRows.map((r) => [r.loanId, Number(r.expensed)]));
  return loans.map((l) => {
    const totalRepayable = l.principalCents + l.interestTotalCents;
    const paidCents = paid.get(l.id) ?? 0;
    return {
      ...l,
      totalRepayable,
      paidCents,
      interestExpensed: expensed.get(l.id) ?? 0,
      outstanding: totalRepayable - paidCents,
      monthlyInstallment: l.termMonths ? Math.ceil(totalRepayable / l.termMonths) : null,
    };
  });
}

/** Ledger balance (credit − debit) of each given liability account. */
export async function liabilityBalances(orgId: number, accountIds: number[]) {
  if (!accountIds.length) return new Map<number, number>();
  const rows = await db
    .select({
      accountId: journalLines.accountId,
      bal: sql<number>`coalesce(sum(${journalLines.creditCents} - ${journalLines.debitCents}), 0)`,
    })
    .from(journalLines)
    .where(and(eq(journalLines.orgId, orgId), inArray(journalLines.accountId, accountIds)))
    .groupBy(journalLines.accountId);
  return new Map(rows.map((r) => [r.accountId, Number(r.bal)]));
}
