import { db, accounts, bankAccounts, externalLoans, externalLoanRepayments, journalLines } from "@/db";
import { and, eq, inArray, sql } from "drizzle-orm";

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

/** Every loan with its repaid principal/interest and outstanding balance. */
export async function loansWithBalances(orgId: number) {
  const loans = await db.select().from(externalLoans).where(eq(externalLoans.orgId, orgId)).orderBy(externalLoans.startDate);
  const sums = await db
    .select({
      loanId: externalLoanRepayments.loanId,
      principal: sql<number>`coalesce(sum(${externalLoanRepayments.principalCents}), 0)`,
      interest: sql<number>`coalesce(sum(${externalLoanRepayments.interestCents}), 0)`,
    })
    .from(externalLoanRepayments)
    .where(eq(externalLoanRepayments.orgId, orgId))
    .groupBy(externalLoanRepayments.loanId);
  const byLoan = new Map(sums.map((s) => [s.loanId, s]));
  return loans.map((l) => {
    const s = byLoan.get(l.id);
    const repaidPrincipal = Number(s?.principal ?? 0);
    return { ...l, repaidPrincipal, paidInterest: Number(s?.interest ?? 0), outstanding: l.principalCents - repaidPrincipal };
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
