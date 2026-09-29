import { db, loanLedger, loanManualRepayments, employees, bankAccounts, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { nowISO, todayISO, fmtKES } from "@/lib/money";
import { postEntry, mirrorBankTxn, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";

// Plain server-side library, imported only by the payroll server-action
// files (which do the auth). It used to carry "use server", which exposed
// these orgId-taking functions as directly callable server actions.

/**
 * Where a staff loan / salary advance came from:
 * - a bank/M-Pesa/cash account id — cash actually paid out now;
 * - "brought_forward" — a balance the employee already owed from before the
 *   org used Zeno (no cash moves now).
 * Either way Accounts Receivable (1200) is debited: every recovery (payroll
 * deduction or direct repayment) credits 1200, so a loan with no debit side
 * drives Receivables below what staff actually owe.
 */
export type LoanDisbursementSource = number | "brought_forward";

export function parseDisbursementSource(raw: FormDataEntryValue | string | null | undefined): LoanDisbursementSource | null {
  const v = String(raw ?? "").trim();
  if (v === "brought_forward") return "brought_forward";
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
}

/** Posts the disbursement entry (DR 1200 · CR bank, or CR Opening Balance
 *  Adjustments 3900 for a brought-forward balance). Must run inside
 *  orgContext.run(). Returns the entry id and the bank account used, if any. */
async function postLoanDisbursement(params: {
  orgId: number;
  loanId: number;
  kind: string;
  employeeName: string;
  principalCents: number;
  source: LoanDisbursementSource;
  date: string;
  memoVerb: string;
}): Promise<{ entryId: number; bankAccountId: number | null }> {
  const { orgId, loanId, kind, employeeName, principalCents, source, date, memoVerb } = params;
  const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "1200"))).limit(1);
  if (!ar) throw new Error("Accounts Receivable account (1200) not found");

  if (source === "brought_forward") {
    const entryId = await postEntry({
      date,
      memo: `${memoVerb} (balance brought forward): ${employeeName}`,
      sourceType: kind === "advance" ? "salary_advance_opening_balance" : "staff_loan_opening_balance",
      sourceId: loanId,
      lines: [
        { accountId: ar.id, debitCents: principalCents },
        { accountId: await acct(SYS.OPENING_BALANCE), creditCents: principalCents },
      ],
    });
    return { entryId, bankAccountId: null };
  }

  const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, source))).limit(1);
  if (!bank) throw new Error("Bank/M-Pesa account not found");
  const entryId = await postEntry({
    date,
    memo: `${memoVerb}: ${employeeName}`,
    sourceType: kind === "advance" ? "salary_advance_disbursement" : "staff_loan_disbursement",
    sourceId: loanId,
    lines: [
      { accountId: ar.id, debitCents: principalCents },
      { accountId: bank.accountId, creditCents: principalCents },
    ],
  });
  await mirrorBankTxn({
    bankAccountId: bank.id,
    date,
    description: `${memoVerb}: ${employeeName}`,
    amountCents: -principalCents,
    journalEntryId: entryId,
    externalRef: `${kind === "advance" ? "salaryadvance" : "staffloan"}:${loanId}`,
  });
  return { entryId, bankAccountId: bank.id };
}

/**
 * Issue a staff loan or salary advance — shared by the direct "Issue Loan"
 * flow (payroll/loans) and the salary-advance flows (payroll/advances): a
 * loanLedger row that payroll's deduction logic recovers through every
 * future run regardless of `kind`, plus its disbursement entry. Must run
 * inside orgContext.run() — postEntry()/mirrorBankTxn() resolve the org via
 * AsyncLocalStorage, not a parameter.
 */
export async function issueStaffLoan(params: {
  orgId: number;
  employeeId: number;
  principalCents: number;
  installmentCents: number;
  type: string;
  kind: "loan" | "advance";
  disbursedFrom: LoanDisbursementSource;
  memoVerb: string; // e.g. "Staff loan issued" or "Salary advance issued"
}): Promise<number> {
  const { orgId, employeeId, principalCents, installmentCents, type, kind, disbursedFrom, memoVerb } = params;

  const [employee] = await db.select().from(employees).where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId))).limit(1);
  if (!employee) throw new Error("Employee not found");
  if (disbursedFrom !== "brought_forward" && !(Number.isInteger(disbursedFrom) && disbursedFrom > 0)) {
    throw new Error("Choose the account it was paid from, or mark it as a balance brought forward");
  }

  const [created] = await db.insert(loanLedger).values({
    orgId,
    employeeId,
    principalCents,
    balanceCents: principalCents,
    installmentCents,
    type,
    kind,
    status: "active",
    createdAt: nowISO(),
  }).returning();

  let posted: { entryId: number; bankAccountId: number | null };
  try {
    posted = await postLoanDisbursement({
      orgId,
      loanId: created.id,
      kind,
      employeeName: employee.name,
      principalCents,
      source: disbursedFrom,
      date: todayISO(),
      memoVerb,
    });
  } catch (e) {
    // Don't leave a loan payroll would start recovering with no debit side.
    await db.delete(loanLedger).where(eq(loanLedger.id, created.id));
    throw e;
  }
  const { entryId, bankAccountId } = posted;
  await db.update(loanLedger)
    .set({ disbursedFromBankAccountId: bankAccountId, disbursementJournalEntryId: entryId })
    .where(eq(loanLedger.id, created.id));

  return created.id;
}

/**
 * Backfills the missing disbursement for a loan/advance issued with "don't
 * record the disbursement" (disbursementJournalEntryId null). Its recoveries
 * already credited Receivables, so the full principal is debited — whether
 * the loan is still active or already repaid. Must run inside
 * orgContext.run().
 */
export async function recordMissingLoanDisbursement(params: {
  orgId: number;
  loanId: number;
  disbursedFrom: LoanDisbursementSource;
  date: string;
}): Promise<number> {
  const { orgId, loanId, disbursedFrom, date } = params;
  const [loan] = await db.select().from(loanLedger).where(and(eq(loanLedger.orgId, orgId), eq(loanLedger.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  if (loan.disbursementJournalEntryId) throw new Error("This loan's disbursement is already recorded");
  const [employee] = await db.select().from(employees).where(and(eq(employees.orgId, orgId), eq(employees.id, loan.employeeId))).limit(1);

  const { entryId, bankAccountId } = await postLoanDisbursement({
    orgId,
    loanId,
    kind: loan.kind,
    employeeName: employee?.name ?? "employee",
    principalCents: loan.principalCents,
    source: disbursedFrom,
    date,
    memoVerb: loan.kind === "advance" ? "Salary advance issued" : "Staff loan issued",
  });
  await db.update(loanLedger)
    .set({ disbursedFromBankAccountId: bankAccountId, disbursementJournalEntryId: entryId })
    .where(and(eq(loanLedger.orgId, orgId), eq(loanLedger.id, loanId)));
  return entryId;
}

/**
 * A direct cash repayment against a staff loan, made outside payroll — the
 * employee hands over cash or pays via M-Pesa directly rather than it being
 * deducted from a future payslip. Posts the exact reverse of issueStaffLoan's
 * disbursement entry: DR the receiving bank/cash account · CR Accounts
 * Receivable (1200), which is the account the loan balance actually lives
 * against. Must run inside orgContext.run() — postEntry()/mirrorBankTxn()
 * resolve the org via AsyncLocalStorage, not a parameter.
 */
export async function recordLoanRepayment(params: {
  orgId: number;
  loanId: number;
  amountCents: number;
  bankAccountId: number;
  date: string;
}): Promise<number> {
  const { orgId, loanId, amountCents, bankAccountId, date } = params;
  if (!amountCents || amountCents <= 0) throw new Error("Enter a valid amount");

  const [loan] = await db.select().from(loanLedger).where(and(eq(loanLedger.orgId, orgId), eq(loanLedger.id, loanId))).limit(1);
  if (!loan) throw new Error("Loan not found");
  if (loan.status === "paid") throw new Error("This loan is already fully repaid");
  if (amountCents > loan.balanceCents) throw new Error(`Amount exceeds the remaining balance of ${fmtKES(loan.balanceCents)}`);

  const [employee] = await db.select().from(employees).where(and(eq(employees.orgId, orgId), eq(employees.id, loan.employeeId))).limit(1);
  const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, bankAccountId))).limit(1);
  if (!bank) throw new Error("Bank/M-Pesa account not found");
  const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "1200"))).limit(1);
  if (!ar) throw new Error("Accounts Receivable account (1200) not found");

  const memo = `Loan repayment: ${employee?.name ?? "employee"}`;
  const entryId = await postEntry({
    date,
    memo,
    sourceType: "staff_loan_repayment",
    sourceId: loanId,
    lines: [
      { accountId: bank.accountId, debitCents: amountCents },
      { accountId: ar.id, creditCents: amountCents },
    ],
  });

  await mirrorBankTxn({
    bankAccountId: bank.id,
    date,
    description: memo,
    amountCents,
    journalEntryId: entryId,
    externalRef: `staffloan-repay:${loanId}:${entryId}`,
  });

  const newBalance = Math.max(0, loan.balanceCents - amountCents);
  await db.update(loanLedger).set({
    balanceCents: newBalance,
    status: newBalance === 0 ? "paid" : "active",
  }).where(eq(loanLedger.id, loanId));

  await db.insert(loanManualRepayments).values({
    orgId,
    loanId,
    amountCents,
    bankAccountId: bank.id,
    journalEntryId: entryId,
    date,
    createdAt: nowISO(),
  });

  return entryId;
}
