import { db, employees, payrollRuns, payrollRunLineItems, statutoryRules, leaveRecords, payrollAdjustments, loanLedger, loanInstallments } from "./src/db/index.js";
import { runPayrollEngine } from "./src/lib/payroll.js";
import { and, eq } from "drizzle-orm";

async function main() {
  try {
    const oId = 1;
    const month = "2024-07";
    
    // Check employees properly
    const activeEmployees = await db.select().from(employees).where(and(eq(employees.orgId, oId), eq(employees.isActive, true)));
    
    if (activeEmployees.length === 0) {
      console.log("No employees found. Creating one...");
      await db.insert(employees).values({
        orgId: oId,
        name: "Test Employee",
        basicSalaryCents: 5000000,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }

    const emps = await db.select().from(employees).where(and(eq(employees.orgId, oId), eq(employees.isActive, true)));
    console.log("Active emps:", emps.length);

    const rules = await db.select().from(statutoryRules).where(eq(statutoryRules.orgId, oId));

    const [run] = await db.insert(payrollRuns).values({
      orgId: oId,
      month,
      status: "draft",
      createdAt: new Date().toISOString()
    }).returning();

    console.log("Run created", run.id);

    const leaves = await db.select().from(leaveRecords).where(and(eq(leaveRecords.orgId, oId), eq(leaveRecords.month, month)));
    const adjustments = await db.select().from(payrollAdjustments).where(and(eq(payrollAdjustments.orgId, oId), eq(payrollAdjustments.correctingRunId, run.id)));
    const loans = await db.select().from(loanLedger).where(and(eq(loanLedger.orgId, oId), eq(loanLedger.status, "active")));

    for (const emp of emps) {
      const empLeave = leaves.find(l => l.employeeId === emp.id)?.unpaidDaysCount || 0;
      const empAdjs = adjustments.filter(a => a.employeeId === emp.id).map(a => ({
        amountCents: a.amountCents,
        isTaxable: a.isTaxable,
        isDeduction: a.isDeduction,
        reason: a.reason
      }));

      const empLoans = loans.filter(l => l.employeeId === emp.id).map(l => ({
        amountCents: l.installmentCents,
        loanId: l.id
      }));

      const lines = runPayrollEngine({
        employeeId: emp.id,
        basicSalaryCents: emp.basicSalaryCents,
        unpaidLeaveDays: empLeave,
        workingDaysInMonth: 21,
        adjustments: empAdjs,
        loanInstallments: empLoans
      }, rules as any);

      console.log("Generated lines", lines.length);

      for (const line of lines) {
        await db.insert(payrollRunLineItems).values({
          orgId: oId,
          payrollRunId: run.id,
          employeeId: emp.id,
          type: line.type,
          subType: line.subType,
          amountCents: line.amountCents,
          isDeduction: line.isDeduction,
          statutoryRuleId: line.statutoryRuleId
        });
      }
      console.log("Lines inserted");
    }
    
    console.log("Success");
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

main();
