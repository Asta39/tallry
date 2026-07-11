import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRuns, payrollRunLineItems, employees, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { notFound } from "next/navigation";
import { PostRunForm } from "./PostRunForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePerm("accountant");
  const o = await getOrg();
  const runId = parseInt(params.id, 10);
  
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));
  if (!run) return notFound();

  const linesData = await db
    .select({
      line: payrollRunLineItems,
      employeeName: employees.name,
      employeePin: employees.kraPin,
    })
    .from(payrollRunLineItems)
    .innerJoin(employees, eq(payrollRunLineItems.employeeId, employees.id))
    .where(eq(payrollRunLineItems.payrollRunId, run.id));

  // Load all accounts to map for posting
  const allAccounts = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.archived, false)));
  const expenseAccounts = allAccounts.filter(a => a.type === "expense");
  const liabilityAccounts = allAccounts.filter(a => a.type === "liability");
  const bankAccounts = allAccounts.filter(a => a.type === "asset"); 

  const empMap = new Map();
  for (const row of linesData) {
    if (!empMap.has(row.line.employeeId)) {
      empMap.set(row.line.employeeId, {
        employeeId: row.line.employeeId,
        employeeName: row.employeeName,
        employeePin: row.employeePin,
        gross: 0,
        net: 0,
        nssf: 0,
        shif: 0,
        ahl: 0,
        paye: 0,
        otherDeductions: 0,
      });
    }
    const e = empMap.get(row.line.employeeId);
    if (row.line.type === "gross_pay" || (row.line.type === "addition" && row.line.subType === "adjustment")) e.gross += row.line.amountCents;
    if (row.line.type === "net_pay") e.net += row.line.amountCents;
    if (row.line.subType === "NSSF") e.nssf += row.line.amountCents;
    if (row.line.subType === "SHIF") e.shif += row.line.amountCents;
    if (row.line.subType === "AHL") e.ahl += row.line.amountCents;
    if (row.line.subType === "PAYE") e.paye += row.line.amountCents;
    if (row.line.type === "deduction" && !["NSSF", "SHIF", "AHL", "PAYE"].includes(row.line.subType || "")) e.otherDeductions += row.line.amountCents;
  }

  const slipsData = Array.from(empMap.values());

  const totalGross = slipsData.reduce((acc, curr) => acc + curr.gross, 0);
  const totalNet = slipsData.reduce((acc, curr) => acc + curr.net, 0);
  const totalTax = slipsData.reduce((acc, curr) => acc + curr.nssf + curr.shif + curr.ahl + curr.paye + curr.otherDeductions, 0);

  return (
    <>
      <PageHeader 
        title={`Payroll Run: ${run.month}`} 
        subtitle="Review payslips and post to the ledger"
        action={
          run.status === "draft" && (
            <PostRunForm 
              runId={run.id}
              expenseAccounts={expenseAccounts}
              liabilityAccounts={liabilityAccounts}
            />
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card bg-base-100 shadow-sm p-6 col-span-1 md:col-span-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-base-content/60">Status</p>
              <span className={`badge mt-1 ${run.status === 'posted' ? 'badge-success badge-outline' : 'badge-warning badge-outline'}`}>
                {run.status.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm text-base-content/60">Total Gross Pay</p>
              <p className="text-xl font-bold">{fmtKES(totalGross)}</p>
            </div>
            <div>
              <p className="text-sm text-base-content/60">Total Deductions</p>
              <p className="text-xl font-bold text-error">{fmtKES(totalTax)}</p>
            </div>
            <div>
              <p className="text-sm text-base-content/60">Total Net Pay</p>
              <p className="text-xl font-bold text-success">{fmtKES(totalNet)}</p>
            </div>
            {run.journalEntryId && (
              <div>
                <p className="text-sm text-base-content/60">Journal</p>
                <Link href={`/accountant/journal/${run.journalEntryId}`} className="text-xl font-bold text-primary hover:underline">
                  #{run.journalEntryId}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Gross Pay</th>
                <th className="text-right">NSSF</th>
                <th className="text-right">SHIF</th>
                <th className="text-right">AHL</th>
                <th className="text-right">PAYE</th>
                <th className="text-right">Other Ded.</th>
                <th className="text-right">Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slipsData.map(row => (
                <tr key={row.employeeId}>
                  <td className="font-medium">
                    {row.employeeName}
                    <div className="text-xs text-base-content/50">{row.employeePin || "No PIN"}</div>
                  </td>
                  <td className="text-right">{fmtKES(row.gross)}</td>
                  <td className="text-right text-error">{fmtKES(row.nssf)}</td>
                  <td className="text-right text-error">{fmtKES(row.shif)}</td>
                  <td className="text-right text-error">{fmtKES(row.ahl)}</td>
                  <td className="text-right text-error">{fmtKES(row.paye)}</td>
                  <td className="text-right text-error">{fmtKES(row.otherDeductions)}</td>
                  <td className="text-right font-bold text-success">{fmtKES(row.net)}</td>
                  <td className="text-right">
                    <a href={`/api/payslip/${run.id}/${row.employeeId}`} target="_blank" className="btn btn-xs btn-outline">PDF</a>
                  </td>
                </tr>
              ))}
              {slipsData.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-base-content/60">No payslips found in this run.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
