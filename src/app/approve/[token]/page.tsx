import { getApprovalRequestByToken } from "@/lib/spend-approvals";
import { fmtKES } from "@/lib/money";
import { ApprovalRequestClient } from "./ApprovalRequestClient";

export const dynamic = "force-dynamic";

export default async function ApprovalRequestPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const row = await getApprovalRequestByToken(token);

  if (!row) {
    return (
      <div className="min-h-screen bg-[var(--color-ink-50)] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-[22px] font-semibold tracking-tight">Approval link unavailable</h1>
          <p className="mt-2 text-[13px] text-[var(--color-ink-500)]">
            This request has already been handled, expired, or is no longer awaiting approval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-ink-50)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Remote approval</div>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
            {row.doc.type === "bill" ? "Bill" : "Expense"} {row.doc.number}
          </h1>
          <p className="mt-1 text-[13px] text-[var(--color-ink-500)]">
            {row.orgRow.name} requested approval through Advanta SMS.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-[var(--color-ink-100)] p-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Date</div>
              <div className="mt-1 text-[14px] font-medium">{row.doc.date}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Amount</div>
              <div className="mt-1 text-[14px] font-medium">{fmtKES(row.doc.totalCents)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Current status</div>
              <div className="mt-1 text-[14px] font-medium">Awaiting approval</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ApprovalRequestClient token={token} initialStatus={row.doc.status} />
        </div>
      </div>
    </div>
  );
}
