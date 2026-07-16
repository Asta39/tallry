"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg } from "@/lib/org";
import { db, employees, payrollRuns, payrollRunLineItems, leaveRecords, payrollAdjustments, loanLedger, loanInstallments, statutoryRules, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { runPayrollEngine, RuleDef } from "@/lib/payroll";
import { postEntry } from "@/lib/posting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPayrollRunAction(formData: FormData) {
  await requirePerm("accountant");
  const o = await getOrg();
  const { assertFeatureEntitlement } = await import("@/lib/billing-server");
  await assertFeatureEntitlement(o.id, "payroll");

  const month = formData.get("month") as string;
  if (!month) throw new Error("Month is required");

  // Prevent duplicate runs for same month
  const existing = await db.select().from(payrollRuns).where(and(eq(payrollRuns.orgId, o.id), eq(payrollRuns.month, month)));
  if (existing.length > 0) {
    redirect(`/payroll/runs/${existing[0].id}`);
  }

  const activeEmployees = await db.select().from(employees).where(and(eq(employees.orgId, o.id), eq(employees.isActive, true)));
  if (activeEmployees.length === 0) {
    redirect("/payroll/employees?error=no_active_employees");
  }

  const rulesData = await db.select().from(statutoryRules).where(eq(statutoryRules.orgId, o.id));
  const rules = rulesData as RuleDef[];

  const [run] = await db.insert(payrollRuns).values({
    orgId: o.id,
    month,
    status: "draft",
    createdAt: new Date().toISOString()
  }).returning();

  const leaves = await db.select().from(leaveRecords).where(and(eq(leaveRecords.orgId, o.id), eq(leaveRecords.month, month)));
  const adjustments = await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.orgId, o.id), eq(payrollAdjustments.correctingRunId, run.id)));
  const loans = await db.select().from(loanLedger).where(and(eq(loanLedger.orgId, o.id), eq(loanLedger.status, "active")));

  for (const emp of activeEmployees) {
    const empLeave = leaves.find(l => l.employeeId === emp.id)?.unpaidDaysCount || 0;
    const empAdjs = adjustments.filter(a => a.employeeId === emp.id).map(a => ({
      amountCents: a.amountCents,
      isTaxable: a.isTaxable,
      isDeduction: a.isDeduction,
      reason: a.reason
    }));

    const empLoans = loans.filter(l => l.employeeId === emp.id).map(l => ({
      amountCents: Math.min(l.installmentCents, l.balanceCents),
      loanId: l.id
    }));

    const lines = runPayrollEngine({
      employeeId: emp.id,
      basicSalaryCents: emp.basicSalaryCents,
      unpaidLeaveDays: empLeave,
      workingDaysInMonth: 21,
      adjustments: empAdjs,
      loanInstallments: empLoans
    }, rules);

    for (const line of lines) {
      await db.insert(payrollRunLineItems).values({
        orgId: o.id,
        payrollRunId: run.id,
        employeeId: emp.id,
        type: line.type,
        subType: line.subType,
        amountCents: line.amountCents,
        isDeduction: line.isDeduction,
        statutoryRuleId: line.statutoryRuleId
      });
    }

    for (const loan of empLoans) {
      await db.insert(loanInstallments).values({
        orgId: o.id,
        loanId: loan.loanId,
        payrollRunId: run.id,
        amountCents: loan.amountCents,
        createdAt: new Date().toISOString()
      });
    }
  }

  revalidatePath("/payroll/runs");
  redirect(`/payroll/runs/${run.id}`);
}

export async function postPayrollRunAction(runId: number, formData: FormData) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const o = await getOrg();

    const expenseAccountId = parseInt(formData.get("expenseAccountId") as string, 10);
    const payablesAccountId = parseInt(formData.get("payablesAccountId") as string, 10);
    const taxLiabilitiesAccountId = parseInt(formData.get("taxLiabilitiesAccountId") as string, 10);

    if (!expenseAccountId || !payablesAccountId || !taxLiabilitiesAccountId) {
      throw new Error("Missing account mappings");
    }

    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));
    if (!run) throw new Error("Not found");
    if (run.status === "posted") throw new Error("Already posted");

    const lines = await db.select().from(payrollRunLineItems).where(eq(payrollRunLineItems.payrollRunId, runId));

    let totalGross = 0;
    let totalNet = 0;
    let totalTax = 0;
    let totalLoans = 0;

    for (const line of lines) {
      if (line.type === "gross_pay") {
        totalGross += line.amountCents;
      } else if (line.type === "net_pay") {
        totalNet += line.amountCents;
      } else if (line.type === "deduction" && line.subType === "loan") {
        totalLoans += line.amountCents;
      } else if (line.type === "deduction" && line.subType !== "adjustment") {
        totalTax += line.amountCents;
      }
    }

    let arAccountId: number | null = null;
    if (totalLoans > 0) {
      const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.code, "1200")));
      if (!ar) throw new Error("Accounts Receivable account (1200) not found. Required for loan recoveries.");
      arAccountId = ar.id;
    }

    const date = new Date(Number(run.month.split("-")[0]), Number(run.month.split("-")[1]), 0).toISOString().slice(0, 10);

    const journalLines = [
      { accountId: expenseAccountId, debitCents: totalGross, creditCents: 0 },
      { accountId: payablesAccountId, debitCents: 0, creditCents: totalNet },
      { accountId: taxLiabilitiesAccountId, debitCents: 0, creditCents: totalTax }
    ];

    if (totalLoans > 0 && arAccountId) {
      journalLines.push({ accountId: arAccountId, debitCents: 0, creditCents: totalLoans });
    }

    const entryId = await postEntry({
      date,
      memo: `Payroll Run for ${run.month}`,
      sourceType: "payroll",
      sourceId: run.id,
      lines: journalLines
    });

    await db.update(payrollRuns).set({
      status: "posted",
      journalEntryId: entryId
    }).where(eq(payrollRuns.id, run.id));

    // Update loan balances
    const installments = await db.select().from(loanInstallments).where(eq(loanInstallments.payrollRunId, run.id));
    for (const inst of installments) {
      const [loan] = await db.select().from(loanLedger).where(eq(loanLedger.id, inst.loanId));
      if (loan) {
        const newBalance = Math.max(0, loan.balanceCents - inst.amountCents);
        await db.update(loanLedger).set({
          balanceCents: newBalance,
          status: newBalance === 0 ? "paid" : "active"
        }).where(eq(loanLedger.id, loan.id));
      }
    }

    revalidatePath(`/payroll/runs/${run.id}`);
    revalidatePath("/payroll/runs");
  });
}

export async function deletePayrollRunAction(runId: number) {
  await requirePerm("accountant");
  const o = await getOrg();

  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));
  if (!run) throw new Error("Not found");
  if (run.status === "posted") throw new Error("Cannot delete a posted run");

  await db.delete(payrollRunLineItems).where(eq(payrollRunLineItems.payrollRunId, runId));
  await db.delete(loanInstallments).where(eq(loanInstallments.payrollRunId, runId));
  await db.delete(payrollAdjustments).where(eq(payrollAdjustments.correctingRunId, runId));
  await db.delete(payrollRuns).where(eq(payrollRuns.id, runId));

  revalidatePath("/payroll/runs");
  redirect("/payroll/runs");
}
