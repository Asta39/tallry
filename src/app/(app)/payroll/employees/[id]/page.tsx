export const dynamic = "force-dynamic";

import { db, employees, loanLedger, payrollRunLineItems, payrollRuns } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { notFound } from "next/navigation";
import { PageHeader, TableCard, Th, Td, StatCard } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";
import { ToggleEmployeeStatusButton } from "../ToggleEmployeeStatusButton";
import { EditEmployeeModal } from "./EditEmployeeModal";

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

  const activeLoanBalance = loans.filter((l) => l.status === "active").reduce((s, l) => s + l.balanceCents, 0);

  return (
    <>
      <PageHeader
        title={employee.name}
        subtitle="Employee profile & history"
        action={
          <div className="flex items-center gap-2">
            <EditEmployeeModal
              employeeId={employee.id}
              name={employee.name}
              basicSalaryCents={employee.basicSalaryCents}
              kraPin={employee.kraPin}
              nssfNumber={employee.nssfNumber}
              shifNumber={employee.shifNumber}
            />
            <a
              href={`/api/pdf/employee/${employee.id}?download=1`}
              target="_blank"
              className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2"
            >
              Export PDF
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Basic salary" cents={employee.basicSalaryCents} />
        <StatCard label="Active loan balance" cents={activeLoanBalance} tone={activeLoanBalance > 0 ? "warn" : "neutral"} />
        <div className="card px-5 py-4">
          <div className="text-[12.5px] text-[var(--color-ink-600)]">Status</div>
          <div className="mt-2">
            <ToggleEmployeeStatusButton employeeId={employee.id} isActive={employee.isActive} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-[13.5px] font-semibold mb-4">Statutory identifiers</h2>
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">KRA PIN</dt>
              <dd className="font-mono text-[var(--color-ink-800)]">{employee.kraPin || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">NSSF No.</dt>
              <dd className="font-mono text-[var(--color-ink-800)]">{employee.nssfNumber || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">SHIF No.</dt>
              <dd className="font-mono text-[var(--color-ink-800)]">{employee.shifNumber || "Not provided"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--color-ink-500)]">Registered</dt>
              <dd className="text-[var(--color-ink-800)]">{employee.createdAt.slice(0, 10)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="text-[13.5px] font-semibold mb-3">Active loans</h2>
          {loans.length === 0 ? (
            <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
              No loans on record.
            </div>
          ) : (
            <TableCard>
              <thead className="hairline-b">
                <tr>
                  <Th>Issue date</Th>
                  <Th right>Principal</Th>
                  <Th right>Balance</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                    <Td>
                      <Link href={`/payroll/loans/${loan.id}`} className="font-medium text-[var(--color-accent-600)] hover:underline">
                        {loan.createdAt.slice(0, 10)}
                      </Link>
                    </Td>
                    <Td right>{fmtKES(loan.principalCents)}</Td>
                    <Td right className="font-medium">{fmtKES(loan.balanceCents)}</Td>
                    <Td>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          loan.status === "active"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {loan.status === "active" ? "Active" : "Cleared"}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>

      <div className="mt-6">
        <h2 className="text-[13.5px] font-semibold mb-3">Recent payslips</h2>
        {payslips.length === 0 ? (
          <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
            No payslips generated yet.
          </div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Month</Th>
                <Th right>Gross pay</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((ps) => (
                <tr key={ps.runId} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                  <Td className="font-medium">{ps.month}</Td>
                  <Td right>{fmtKES(ps.grossPay)}</Td>
                  <Td right>
                    <Link href={`/payroll/runs/${ps.runId}`} className="text-[12.5px] font-medium text-[var(--color-accent-600)] hover:underline">
                      View run →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </>
  );
}
