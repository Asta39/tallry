import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, loanLedger, employees } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

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
    .where(and(eq(loanLedger.orgId, o.id), eq(loanLedger.kind, "loan")));

  return (
    <>
      <PageHeader
        title="Loans"
        subtitle="Longer-term staff loans, recovered through payroll deductions"
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
                <Td className="font-medium">
                  <Link href={`/payroll/loans/${row.loan.id}`} className="text-[var(--color-accent-600)] hover:underline">
                    {row.employeeName}
                  </Link>
                </Td>
                <Td className="capitalize">{row.loan.type.replace("_", " ")}</Td>
                <Td right>{fmtKES(row.loan.principalCents)}</Td>
                <Td right>{fmtKES(row.loan.installmentCents)}/mo</Td>
                <Td right className="font-bold">{fmtKES(row.loan.balanceCents)}</Td>
                <Td>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      row.loan.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]"
                    }`}
                  >
                    {row.loan.status}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
