import { db, employees, loanLedger, payrollRunLineItems, payrollRuns } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { notFound } from "next/navigation";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export default async function EmployeeDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePerm("payroll");
  const o = await getOrg();
  const params = await props.params;

  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, Number(params.id)), eq(employees.orgId, o.id)))
    .limit(1);

  if (!employee) {
    notFound();
  }

  const loans = await db
    .select()
    .from(loanLedger)
    .where(and(eq(loanLedger.employeeId, employee.id), eq(loanLedger.orgId, o.id)))
    .orderBy(desc(loanLedger.createdAt));

  const payslips = await db
    .select({
      month: payrollRuns.month,
      runId: payrollRuns.id,
      grossPay: payrollRunLineItems.amountCents,
    })
    .from(payrollRunLineItems)
    .innerJoin(payrollRuns, eq(payrollRunLineItems.payrollRunId, payrollRuns.id))
    .where(and(
      eq(payrollRunLineItems.employeeId, employee.id),
      eq(payrollRunLineItems.type, "gross_pay")
    ))
    .orderBy(desc(payrollRuns.month));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader 
          title={employee.name}
          subtitle={`Employee Profile & History`}
        />
        <a 
          href={`/api/pdf/employee/${employee.id}?download=1`}
          target="_blank"
          className="inline-flex items-center gap-2 bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] px-3 py-1.5 rounded-lg text-[13px] font-medium shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Profile PDF
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] p-6 shadow-sm">
          <h3 className="text-[13px] font-semibold text-[var(--color-ink-900)] mb-4">Employee Details</h3>
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">Basic Salary</dt>
              <dd className="font-medium">{fmtKES(employee.basicSalaryCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">Status</dt>
              <dd>
                {employee.isActive ? 
                  <span className="badge badge-success badge-sm">Active</span> : 
                  <span className="badge badge-error badge-sm">Suspended</span>
                }
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">KRA PIN</dt>
              <dd className="font-mono text-[var(--color-ink-700)]">{employee.kraPin || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">NSSF No.</dt>
              <dd className="font-mono text-[var(--color-ink-700)]">{employee.nssfNumber || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">SHIF No.</dt>
              <dd className="font-mono text-[var(--color-ink-700)]">{employee.shifNumber || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">Registered</dt>
              <dd className="text-[var(--color-ink-700)]">{employee.createdAt.slice(0, 10)}</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-ink-900)] mb-3">Active Loans</h3>
            {loans.length === 0 ? (
              <div className="bg-white rounded-xl border border-[var(--color-ink-200)] p-4 text-center text-[12px] text-[var(--color-ink-500)]">
                No loans on record.
              </div>
            ) : (
              <TableCard>
                <thead className="hairline-b">
                  <tr>
                    <Th>Issue Date</Th>
                    <Th>Principal</Th>
                    <Th>Balance</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map(loan => (
                    <tr key={loan.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                      <Td>
                        <Link href={`/payroll/loans/${loan.id}`} className="text-[var(--color-accent-600)] hover:underline">
                          {loan.createdAt.slice(0, 10)}
                        </Link>
                      </Td>
                      <Td>{fmtKES(loan.principalCents)}</Td>
                      <Td>{fmtKES(loan.balanceCents)}</Td>
                      <Td>
                        {loan.status === "active" ? 
                          <span className="badge badge-warning badge-sm">Active</span> : 
                          <span className="badge badge-success badge-sm">Cleared</span>
                        }
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-[var(--color-ink-900)] mb-3">Recent Payslips</h3>
            {payslips.length === 0 ? (
              <div className="bg-white rounded-xl border border-[var(--color-ink-200)] p-4 text-center text-[12px] text-[var(--color-ink-500)]">
                No payslips generated yet.
              </div>
            ) : (
              <TableCard>
                <thead className="hairline-b">
                  <tr>
                    <Th>Month</Th>
                    <Th>Gross Pay</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(ps => (
                    <tr key={ps.runId} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                      <Td className="font-medium">{ps.month}</Td>
                      <Td>{fmtKES(ps.grossPay)}</Td>
                      <Td>
                        <Link href={`/payroll/runs/${ps.runId}`} className="text-[12px] text-[var(--color-accent-600)] hover:underline font-medium">
                          View Run &rarr;
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
