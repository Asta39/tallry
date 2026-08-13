"use server";

import { db, loanLedger, employees, bankAccounts, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { getAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { nowISO, todayISO } from "@/lib/money";
import { postEntry, mirrorBankTxn } from "@/lib/posting";

export async function createLoanAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");

  const employeeId = Number(formData.get("employeeId"));
  const principalCents = Math.round(Number(formData.get("principal")) * 100);
  const installmentCents = Math.round(Number(formData.get("installment")) * 100);
  const type = String(formData.get("type")) || "amortizing";
  const disbursedFromBankAccountId = formData.get("disbursedFromBankAccountId") ? Number(formData.get("disbursedFromBankAccountId")) : null;

  if (!employeeId || principalCents <= 0 || installmentCents <= 0) {
    throw new Error("Invalid input");
  }

  const [employee] = await db.select().from(employees).where(and(eq(employees.orgId, access.orgId), eq(employees.id, employeeId))).limit(1);
  if (!employee) throw new Error("Employee not found");

  // Records the actual cash disbursement — DR Accounts Receivable (1200) ·
  // CR the bank/cash it was paid from. Without this, a staff loan had no
  // ledger impact at all when issued, yet its recovery already credited AR
  // on every payroll deduction (see payroll/runs/actions.ts) — meaning AR
  // was quietly driven negative by every loan ever recovered, with no
  // offsetting debit anywhere.
  let disbursementJournalEntryId: number | null = null;
  let bank: { id: number; accountId: number } | undefined;
  if (disbursedFromBankAccountId) {
    const [b] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, access.orgId), eq(bankAccounts.id, disbursedFromBankAccountId))).limit(1);
    if (!b) throw new Error("Bank/M-Pesa account not found");
    bank = b;
    const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, access.orgId), eq(accounts.code, "1200"))).limit(1);
    if (!ar) throw new Error("Accounts Receivable account (1200) not found");
    disbursementJournalEntryId = await postEntry({
      date: todayISO(),
      memo: `Staff loan issued: ${employee.name}`,
      sourceType: "staff_loan_disbursement",
      lines: [
        { accountId: ar.id, debitCents: principalCents },
        { accountId: bank.accountId, creditCents: principalCents },
      ],
    });
  }

  const [created] = await db.insert(loanLedger).values({
    orgId: access.orgId,
    employeeId,
    principalCents,
    balanceCents: principalCents,
    installmentCents,
    type,
    status: "active",
    disbursedFromBankAccountId,
    disbursementJournalEntryId,
    createdAt: nowISO(),
  }).returning();

  if (bank && disbursementJournalEntryId) {
    await mirrorBankTxn({
      bankAccountId: bank.id,
      date: todayISO(),
      description: `Staff loan issued: ${employee.name}`,
      amountCents: -principalCents,
      journalEntryId: disbursementJournalEntryId,
      externalRef: `staffloan:${created.id}`,
    });
  }

  redirect("/payroll/loans");
}
