import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRuns, payslips, employees, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { notFound } from "next/navigation";
import { PostRunForm } from "./PostRunForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailsPage({ params }: { params: { id: string } }) {
  await requirePerm("accountant");
  const o = await getOrg();
  const runId = parseInt(params.id, 10);
  
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));
  if (!run) return notFound();

  const slipsData = await db
    .select({
      slip: payslips,
      employeeName: employees.name,
      employeePin: employees.kraPin,
    })
    .from(payslips)
    .innerJoin(employees, eq(payslips.employeeId, employees.id))
    .where(eq(payslips.payrollRunId, run.id));

  // Load all accounts to map for posting
  const allAccounts = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.archived, false)));
  const expenseAccounts = allAccounts.filter(a => a.type === "expense");
  const liabilityAccounts = allAccounts.filter(a => a.type === "liability");
  const bankAccounts = allAccounts.filter(a => a.type === "asset"); // For net pay if paid immediately, but usually payable

  const totalGross = slipsData.reduce((acc, curr) => acc + curr.slip.grossPayCents, 0);
  const totalNet = slipsData.reduce((acc, curr) => acc + curr.slip.netPayCents, 0);
  const totalTax = slipsData.reduce((acc, curr) => acc + curr.slip.payeCents + curr.slip.nssfCents + curr.slip.shifCents + curr.slip.housingLevyCents, 0);

  return (
    <>
      <PageHeader 
        title={`Payroll Run: ${run.month}`} 
        subtitle="Review payslips and post to the ledger"
        backLink="/payroll/runs"
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
        <div className="card p-6 border border-base-content/10 col-span-1 md:col-span-3">
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

      <div className="card mt-6">
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Gross Pay</th>
                <th className="text-right">NSSF</th>
                <th className="text-right">SHIF</th>
                <th className="text-right">Housing Levy</th>
                <th className="text-right">PAYE</th>
                <th className="text-right">Net Pay</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {slipsData.map(row => (
                <tr key={row.slip.id}>
                  <td className="font-medium">
                    {row.employeeName}
                    <div className="text-xs text-base-content/50">{row.employeePin || "No PIN"}</div>
                  </td>
                  <td className="text-right">{fmtKES(row.slip.grossPayCents)}</td>
                  <td className="text-right text-error">{fmtKES(row.slip.nssfCents)}</td>
                  <td className="text-right text-error">{fmtKES(row.slip.shifCents)}</td>
                  <td className="text-right text-error">{fmtKES(row.slip.housingLevyCents)}</td>
                  <td className="text-right text-error">{fmtKES(row.slip.payeCents)}</td>
                  <td className="text-right font-bold text-success">{fmtKES(row.slip.netPayCents)}</td>
                  <td className="text-right">
                    <a href={`/api/payslip/${row.slip.id}`} target="_blank" className="btn btn-xs btn-outline">PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
