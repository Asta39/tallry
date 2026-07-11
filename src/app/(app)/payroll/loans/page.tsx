import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, loanLedger, employees } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
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
        action={<PrimaryLink href="/payroll/loans/new">Issue Loan</PrimaryLink>}
      />

      {loans.length === 0 ? (
        <div className="mt-8 text-center text-[var(--color-ink-500)] text-[13px]">
          No loans issued yet.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Employee</Th>
              <Th>Type</Th>
              <Th right>Principal</Th>
              <Th right>Installment</Th>
              <Th right>Balance</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {loans.map((row) => (
              <tr key={row.loan.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">{row.employeeName}</Td>
                <Td className="capitalize">{row.loan.type.replace("_", " ")}</Td>
                <Td right>{fmtKES(row.loan.principalCents)}</Td>
                <Td right>{fmtKES(row.loan.installmentCents)}/mo</Td>
                <Td right className="font-bold">{fmtKES(row.loan.balanceCents)}</Td>
                <Td>
                  <div className={`badge badge-sm ${row.loan.status === "active" ? "badge-success" : "badge-ghost"}`}>
                    {row.loan.status}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
