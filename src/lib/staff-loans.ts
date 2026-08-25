"use server";

import { db, loanLedger, employees, bankAccounts, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { nowISO, todayISO } from "@/lib/money";
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
