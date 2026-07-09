"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees, payrollRuns, payslips, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { calculatePayroll } from "@/lib/payroll";
import { postEntry } from "@/lib/posting";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPayrollRunAction(formData: FormData) {
  await requirePerm("accountant");
  const o = await getOrg();

  const month = formData.get("month") as string;
  if (!month) throw new Error("Month is required");

  // Prevent duplicate runs for same month (simple check)
  const existing = await db.select().from(payrollRuns).where(and(eq(payrollRuns.orgId, o.id), eq(payrollRuns.month, month)));
  if (existing.length > 0) throw new Error(`A payroll run for ${month} already exists`);

  const activeEmployees = await db.select().from(employees).where(and(eq(employees.orgId, o.id), eq(employees.isActive, true)));
  if (activeEmployees.length === 0) throw new Error("No active employees found");

  // 1. Create run
  const [run] = await db.insert(payrollRuns).values({
    orgId: o.id,
    month,
    status: "draft",
    createdAt: new Date().toISOString()
  }).returning();

  // 2. Create payslips
  for (const emp of activeEmployees) {
    const calc = calculatePayroll(emp.basicSalaryCents);
    await db.insert(payslips).values({
      orgId: o.id,
      payrollRunId: run.id,
      employeeId: emp.id,
      ...calc
    });
  }

  revalidatePath("/payroll/runs");
  redirect(`/payroll/runs/${run.id}`);
}

export async function postPayrollRunAction(runId: number, formData: FormData) {
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

  const slips = await db.select().from(payslips).where(eq(payslips.payrollRunId, runId));

  let totalGross = 0;
  let totalNet = 0;
  let totalTax = 0;

  for (const s of slips) {
    totalGross += s.grossPayCents;
    totalNet += s.netPayCents;
    totalTax += s.nssfCents + s.shifCents + s.housingLevyCents + s.payeCents;
  }

  // Double check math
  if (totalGross !== totalNet + totalTax) throw new Error("Payroll math mismatch");

  // Post Journal
  const date = new Date(Number(run.month.split("-")[0]), Number(run.month.split("-")[1]), 0).toISOString().slice(0, 10); // last day of month

  const entryId = await postEntry({
    date,
    memo: `Payroll Run for ${run.month}`,
    sourceType: "payroll",
    sourceId: run.id,
    lines: [
      { accountId: expenseAccountId, debitCents: totalGross, creditCents: 0 },
      { accountId: payablesAccountId, debitCents: 0, creditCents: totalNet },
      { accountId: taxLiabilitiesAccountId, debitCents: 0, creditCents: totalTax }
    ]
  });

  await db.update(payrollRuns).set({
    status: "posted",
    journalEntryId: entryId
  }).where(eq(payrollRuns.id, run.id));

  revalidatePath(`/payroll/runs/${run.id}`);
  revalidatePath("/payroll/runs");
}
