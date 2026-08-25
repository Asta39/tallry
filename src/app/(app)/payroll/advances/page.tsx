import { redirect } from "next/navigation";
import { getAccess } from "@/lib/access";
import { db, employees, members, bankAccounts, salaryAdvanceRequests, loanLedger } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryButton, PrimaryLink } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { requestAdvanceAction } from "./actions";
import { AdvanceReviewRow } from "./AdvanceReviewRow";

export const dynamic = "force-dynamic";

export default async function SalaryAdvancesPage() {
  const access = await getAccess();
  if (!access) redirect("/login");
  if (!access.perms.has("salary_advances")) redirect("/");

  const canManage = access.perms.has("payroll");

  if (canManage) {
    const [pending, allAdvances, banks] = await Promise.all([
      db
        .select({ req: salaryAdvanceRequests, employeeName: employees.name })
        .from(salaryAdvanceRequests)
        .innerJoin(employees, eq(salaryAdvanceRequests.employeeId, employees.id))
        .where(and(eq(salaryAdvanceRequests.orgId, access.orgId), eq(salaryAdvanceRequests.status, "pending")))
        .orderBy(desc(salaryAdvanceRequests.createdAt)),
      db
        .select({ loan: loanLedger, employeeName: employees.name })
        .from(loanLedger)
        .innerJoin(employees, eq(loanLedger.employeeId, employees.id))
        .where(and(eq(loanLedger.orgId, access.orgId), eq(loanLedger.kind, "advance")))
        .orderBy(desc(loanLedger.createdAt)),
      db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, access.orgId), eq(bankAccounts.archived, false))),
    ]);
    const bankOptions = banks.map((b) => ({ id: b.id, name: b.name }));

    return (
      <>
        <PageHeader
          title="Salary Advances"
          subtitle="Requests from staff, plus advances issued directly — recovered through payroll deductions"
          action={<PrimaryLink href="/payroll/advances/new">Issue Advance</PrimaryLink>}
        />

        <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">
          Pending requests {pending.length > 0 && <span className="text-[var(--color-bad)]">({pending.length})</span>}
        </h2>
        {pending.length === 0 ? (
          <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)] mb-8">No pending requests.</div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Employee</Th>
                <Th>Requested</Th>
                <Th right>Amount</Th>
                <Th>Reason</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.req.id} className="hairline-t">
                  <Td className="font-medium">{row.employeeName}</Td>
                  <Td>{row.req.createdAt.slice(0, 10)}</Td>
                  <Td right>{fmtKES(row.req.amountCents)}</Td>
                  <Td>{row.req.reason || "—"}</Td>
                  <Td right><AdvanceReviewRow requestId={row.req.id} banks={bankOptions} /></Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}

        <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mt-8 mb-3">All advances</h2>
        {allAdvances.length === 0 ? (
          <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No advances issued yet.</div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Employee</Th>
                <Th right>Principal</Th>
                <Th right>Installment</Th>
                <Th right>Balance</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {allAdvances.map((row) => (
                <tr key={row.loan.id} className="hairline-t">
                  <Td className="font-medium">{row.employeeName}</Td>
                  <Td right>{fmtKES(row.loan.principalCents)}</Td>
                  <Td right>{fmtKES(row.loan.installmentCents)}/mo</Td>
                  <Td right className="font-semibold">{fmtKES(row.loan.balanceCents)}</Td>
                  <Td>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${row.loan.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]"}`}>
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

  // Staff self-service view: request an advance, see own status/history.
  const [me] = access.memberId
    ? await db.select({ employeeId: members.employeeId }).from(members).where(eq(members.id, access.memberId)).limit(1)
    : [];

  if (!me?.employeeId) {
    return (
      <>
        <PageHeader title="Salary Advances" subtitle="Request an advance against your pay" />
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          Your account isn't linked to a payroll employee record yet — ask your admin to link it in Staff &amp; Roles before you can request an advance.
        </div>
      </>
    );
  }

  const myRequests = await db
    .select()
    .from(salaryAdvanceRequests)
    .where(and(eq(salaryAdvanceRequests.orgId, access.orgId), eq(salaryAdvanceRequests.employeeId, me.employeeId)))
    .orderBy(desc(salaryAdvanceRequests.createdAt));

  const statusLabel: Record<string, string> = { pending: "Awaiting review", approved: "Approved & disbursed", rejected: "Rejected" };
  const statusStyle: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
  };

  return (
    <>
      <PageHeader title="Salary Advances" subtitle="Request an advance against your pay, and track its status" />

      <form action={requestAdvanceAction} className="card p-6 max-w-md mb-8 space-y-4">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KES)</span>
          <input name="amount" type="number" step="0.01" min="1" required placeholder="0.00" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1" />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reason (optional)</span>
          <textarea name="reason" rows={2} className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1" />
        </label>
        <PrimaryButton>Request advance</PrimaryButton>
      </form>

      <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">Your requests</h2>
      {myRequests.length === 0 ? (
        <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No requests yet.</div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th right>Amount</Th>
              <Th>Reason</Th>
              <Th>Status</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {myRequests.map((r) => (
              <tr key={r.id} className="hairline-t">
                <Td>{r.createdAt.slice(0, 10)}</Td>
                <Td right>{fmtKES(r.amountCents)}</Td>
                <Td>{r.reason || "—"}</Td>
                <Td>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusStyle[r.status] ?? ""}`}>
                    {statusLabel[r.status] ?? r.status}
                  </span>
                </Td>
                <Td>{r.reviewNote || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
