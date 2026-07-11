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
  const isAdmin = access?.role === "admin";
  
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
                  {isAdmin ? (
                    <ToggleEmployeeStatusButton employeeId={e.id} isActive={e.isActive} />
                  ) : (
                    <span className={`badge badge-sm ${e.isActive ? 'badge-success badge-outline' : 'badge-neutral'}`}>
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
