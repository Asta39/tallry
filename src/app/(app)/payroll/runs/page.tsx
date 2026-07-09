import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRuns } from "@/db";
import { eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { createPayrollRunAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PayrollRunsPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  
  const runs = await db.select().from(payrollRuns).where(eq(payrollRuns.orgId, o.id)).orderBy(desc(payrollRuns.month));

  return (
    <>
      <PageHeader 
        title="Payroll" 
        subtitle="Manage monthly payroll runs and statutory deductions"
      />

      {/* Basic Payroll Nav */}
      <div className="tabs tabs-boxed mb-6 bg-transparent">
        <Link href="/payroll/runs" className="tab tab-active font-medium bg-white">Payroll Runs</Link>
        <Link href="/payroll/employees" className="tab font-medium">Employees</Link>
      </div>

      <div className="card mt-6">
        <div className="flex justify-between items-center p-4 border-b border-base-content/10">
          <h2 className="font-semibold">Recent Runs</h2>
          <form action={createPayrollRunAction} className="flex gap-2 items-center">
            <input name="month" type="month" required className="input input-sm input-bordered" defaultValue={new Date().toISOString().slice(0, 7)} />
            <button type="submit" className="btn btn-sm btn-primary">Create Run</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Status</th>
                <th>Journal Entry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-base-content/50">
                    No payroll runs found.
                  </td>
                </tr>
              ) : (
                runs.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.month}</td>
                    <td>
                      <span className={`badge ${r.status === 'posted' ? 'badge-success badge-outline' : 'badge-warning badge-outline'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.journalEntryId ? `#${r.journalEntryId}` : "-"}</td>
                    <td className="text-right">
                      <Link href={`/payroll/runs/${r.id}`} className="btn btn-xs btn-outline">View</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
