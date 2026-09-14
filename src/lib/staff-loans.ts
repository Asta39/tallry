"use server";

import { db, loanLedger, loanManualRepayments, employees, bankAccounts, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { nowISO, todayISO, fmtKES } from "@/lib/money";
import { postEntry, mirrorBankTxn } from "@/lib/posting";

/**
 * Issue a staff loan or salary advance — shared by the direct "Issue Loan"
 * flow (payroll/loans) and the salary-advance approval flow
 * (payroll/advances), which both need the exact same posting: DR Accounts
 * Receivable (1200) · CR the bank/cash it was disbursed from, then a
 * loanLedger row that payroll's deduction logic already recovers through
 * every future run regardless of `kind`. Must run inside orgContext.run()
 * — postEntry()/mirrorBankTxn() resolve the org via AsyncLocalStorage, not
 * a parameter.
 */
export async function issueStaffLoan(params: {
  orgId: number;
  employeeId: number;
  principalCents: number;
  installmentCents: number;
  type: string;
  kind: "loan" | "advance";
  disbursedFromBankAccountId: number | null;
  memoVerb: string; // e.g. "Staff loan issued" or "Salary advance issued"
}): Promise<number> {
  const { orgId, employeeId, principalCents, installmentCents, type, kind, disbursedFromBankAccountId, memoVerb } = params;

  const [employee] = await db.select().from(employees).where(and(eq(employees.orgId, orgId), eq(employees.id, employeeId))).limit(1);
  if (!employee) throw new Error("Employee not found");

  let disbursementJournalEntryId: number | null = null;
  let bank: { id: number; accountId: number } | undefined;
  if (disbursedFromBankAccountId) {
    const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, disbursedFromBankAccountId))).limit(1);
    if (!b) throw new Error("Bank/M-Pesa account not found");
    bank = b;
    const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "1200"))).limit(1);
    if (!ar) throw new Error("Accounts Receivable account (1200) not found");
    disbursementJournalEntryId = await postEntry({
      date: todayISO(),
      memo: `${memoVerb}: ${employee.name}`,
      sourceType: kind === "advance" ? "salary_advance_disbursement" : "staff_loan_disbursement",
      lines: [
        { accountId: ar.id, debitCents: principalCents },
        { accountId: bank.accountId, creditCents: principalCents },
      ],
    });
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
    disbursedFromBankAccountId,
    disbursementJournalEntryId,
    createdAt: nowISO(),
  }).returning();

  if (bank && disbursementJournalEntryId) {
    await mirrorBankTxn({
      bankAccountId: bank.id,
      date: todayISO(),
      description: `${memoVerb}: ${employee.name}`,
      amountCents: -principalCents,
      journalEntryId: disbursementJournalEntryId,
      externalRef: `${kind === "advance" ? "salaryadvance" : "staffloan"}:${created.id}`,
    });
  }

  return created.id;
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
