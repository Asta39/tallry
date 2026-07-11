import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  
  const allEmployees = await db.select().from(employees).where(
    eq(employees.orgId, o.id)
  );

  return (
    <>
      <PageHeader 
        title="Employees" 
        subtitle="Manage payroll staff and basic salaries"
        action={<Link href="/payroll/employees/new" className="btn btn-primary">Add Employee</Link>}
      />

      {/* Basic Payroll Nav */}
      <div className="tabs tabs-boxed mb-6 bg-transparent">
        <Link href="/payroll/runs" className="tab font-medium">Payroll Runs</Link>
        <Link href="/payroll/employees" className="tab tab-active font-medium bg-white">Employees</Link>
      </div>

      <div className="card bg-base-100 shadow-sm border border-base-content/10">
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-base-200/50">
              <tr>
                <th>Name</th>
                <th>KRA PIN</th>
                <th>NSSF No.</th>
                <th>SHIF No.</th>
                <th className="text-right">Basic Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-content/50">
                    No employees registered yet.
                  </td>
                </tr>
              ) : (
                allEmployees.map(e => (
                  <tr key={e.id}>
                    <td className="font-medium">{e.name}</td>
                    <td>{e.kraPin || "-"}</td>
                    <td>{e.nssfNumber || "-"}</td>
                    <td>{e.shifNumber || "-"}</td>
                    <td className="text-right">{fmtKES(e.basicSalaryCents)}</td>
                    <td>
                      <span className={`badge ${e.isActive ? 'badge-success badge-outline' : 'badge-neutral'}`}>
                        {e.isActive ? 'Active' : 'Inactive'}
                      </span>
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
