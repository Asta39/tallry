import { db, employees, loanLedger, loanInstallments } from "@/db";
import { and, eq, asc } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { notFound } from "next/navigation";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export default async function LoanDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePerm("payroll");
  const o = await getOrg();
  const params = await props.params;

  const [loan] = await db
    .select({
      id: loanLedger.id,
      principalCents: loanLedger.principalCents,
      balanceCents: loanLedger.balanceCents,
      installmentCents: loanLedger.installmentCents,
      status: loanLedger.status,
      createdAt: loanLedger.createdAt,
      employeeName: employees.name,
      employeeId: employees.id,
    })
    .from(loanLedger)
    .innerJoin(employees, eq(loanLedger.employeeId, employees.id))
    .where(and(eq(loanLedger.id, Number(params.id)), eq(loanLedger.orgId, o.id)))
    .limit(1);

  if (!loan) {
    notFound();
  }

  const installments = await db
    .select({
      id: loanInstallments.id,
      amountCents: loanInstallments.amountCents,
      payrollRunId: loanInstallments.payrollRunId,
      month: payrollRuns.month,
      createdAt: loanInstallments.createdAt,
    })
    .from(loanInstallments)
    .innerJoin(payrollRuns, eq(loanInstallments.payrollRunId, payrollRuns.id))
    .where(eq(loanInstallments.loanId, loan.id))
    .orderBy(asc(loanInstallments.createdAt));

  const totalPaid = loan.principalCents - loan.balanceCents;
  const remainingBalance = loan.balanceCents;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <PageHeader 
          title={`Loan #${loan.id} - ${loan.employeeName}`}
          subtitle={`Amortization & Schedule`}
          backLink="/payroll/loans"
        />
        <a 
          href={`/api/pdf/loan/${loan.id}?download=1`}
          target="_blank"
          className="inline-flex items-center gap-2 bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] px-3 py-1.5 rounded-lg text-[13px] font-medium shadow-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Loan Statement
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[var(--color-ink-200)] p-4 rounded-xl shadow-sm text-center">
          <p className="text-[11px] font-medium text-[var(--color-ink-500)] uppercase tracking-wide">Principal</p>
          <p className="text-xl font-bold text-[var(--color-ink-900)] mt-1">{fmtKES(loan.principalCents)}</p>
        </div>
        <div className="bg-white border border-[var(--color-ink-200)] p-4 rounded-xl shadow-sm text-center">
          <p className="text-[11px] font-medium text-[var(--color-ink-500)] uppercase tracking-wide">Total Repaid</p>
          <p className="text-xl font-bold text-[var(--color-success-600)] mt-1">{fmtKES(totalPaid)}</p>
        </div>
        <div className="bg-white border border-[var(--color-ink-200)] p-4 rounded-xl shadow-sm text-center">
          <p className="text-[11px] font-medium text-[var(--color-ink-500)] uppercase tracking-wide">Remaining Balance</p>
          <p className="text-xl font-bold text-[var(--color-error-600)] mt-1">{fmtKES(remainingBalance)}</p>
        </div>
        <div className="bg-white border border-[var(--color-ink-200)] p-4 rounded-xl shadow-sm text-center">
          <p className="text-[11px] font-medium text-[var(--color-ink-500)] uppercase tracking-wide">Status</p>
          <p className="mt-1">
            {loan.status === "active" ? 
              <span className="badge badge-warning">Active</span> : 
              <span className="badge badge-success">Cleared</span>
            }
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-[14px] font-semibold text-[var(--color-ink-900)] mb-4">Installment Schedule</h3>
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Month</Th>
              <Th>Amount Paid</Th>
              <Th>Payroll Run</Th>
            </tr>
          </thead>
          <tbody>
            {installments.map(inst => (
              <tr key={inst.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">{inst.month}</Td>
                <Td>{fmtKES(inst.amountCents)}</Td>
                <Td>
                  {inst.payrollRunId ? (
                    <Link href={`/payroll/runs/${inst.payrollRunId}`} className="text-[var(--color-accent-600)] hover:underline">
                      Run #{inst.payrollRunId}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-ink-400)]">-</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </div>
    </div>
  );
}
