import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, loanLedger, employees } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PayrollLoansPage() {
  await requirePerm("payroll");
  const o = await getOrg();

  const loans = await db
    .select({
      loan: loanLedger,
      employeeName: employees.name,
    })
    .from(loanLedger)
    .innerJoin(employees, eq(loanLedger.employeeId, employees.id))
    .where(eq(loanLedger.orgId, o.id));

  return (
    <>
      <PageHeader 
        title="Loans & Deductions" 
        subtitle="Manage employee salary advances and loans"
        action={<button className="btn btn-primary btn-sm">Issue Loan</button>}
      />

      <div className="card bg-base-100 shadow-sm mt-6">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th className="text-right">Principal</th>
                <th className="text-right">Installment</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((row) => (
                <tr key={row.loan.id}>
                  <td className="font-medium">{row.employeeName}</td>
                  <td className="capitalize">{row.loan.type.replace("_", " ")}</td>
                  <td className="text-right">{fmtKES(row.loan.principalCents)}</td>
                  <td className="text-right">{fmtKES(row.loan.installmentCents)}/mo</td>
                  <td className="text-right font-bold">{fmtKES(row.loan.balanceCents)}</td>
                  <td>
                    <div className={`badge badge-sm ${row.loan.status === "active" ? "badge-success" : "badge-ghost"}`}>
                      {row.loan.status}
                    </div>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-base-content/60">
                    No loans issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
