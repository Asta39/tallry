import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { getAccess } from "@/lib/access";
import { ToggleEmployeeStatusButton } from "./ToggleEmployeeStatusButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requirePerm("payroll");
  const o = await getOrg();
  const access = await getAccess();
  // Anyone who can open payroll (admin, HR, accountant, custom roles granted
  // it) may suspend/activate — restricting this to admin/HR locked the
  // accountant out (their click hit a server-side rejection). Mirrors
  // toggleEmployeeStatusAction's own guard.
  const canManageStatus = access?.role === "admin" || !!access?.perms.has("payroll");
  
  const allEmployees = await db.select().from(employees).where(
    eq(employees.orgId, o.id)
  );

  return (
    <>
      <PageHeader 
        title="Employees" 
        subtitle="Manage payroll staff and basic salaries"
        action={<PrimaryLink href="/payroll/employees/new">Add Employee</PrimaryLink>}
      />

      {allEmployees.length === 0 ? (
        <div className="mt-8 text-center text-[var(--color-ink-500)] text-[13px]">
          No employees registered yet.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Name</Th>
              <Th>KRA PIN</Th>
              <Th>NSSF No.</Th>
              <Th>SHIF No.</Th>
              <Th right>Basic Salary</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {allEmployees.map(e => (
              <tr key={e.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">
                  <Link href={`/payroll/employees/${e.id}`} className="text-[var(--color-accent-600)] hover:underline">
                    {e.name}
                  </Link>
                </Td>
                <Td>{e.kraPin || "-"}</Td>
                <Td>{e.nssfNumber || "-"}</Td>
                <Td>{e.shifNumber || "-"}</Td>
                <Td right>{fmtKES(e.basicSalaryCents)}</Td>
                <Td>
                  {canManageStatus ? (
                    <ToggleEmployeeStatusButton employeeId={e.id} isActive={e.isActive} />
                  ) : (
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${e.isActive ? 'bg-[var(--color-success-50)] text-[var(--color-success-700)] border-[var(--color-success-200)]' : 'bg-[var(--color-ink-50)] text-[var(--color-ink-500)] border-[var(--color-ink-200)]'}`}>
                      {e.isActive ? 'Active' : 'Suspended'}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
