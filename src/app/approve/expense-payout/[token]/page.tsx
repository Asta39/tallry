import { getExpenseClaimPayoutApprovalByToken } from "@/lib/expense-claims";
import { fmtKES } from "@/lib/money";
import { ExpenseClaimPayoutApprovalClient } from "./ExpenseClaimPayoutApprovalClient";

export const dynamic = "force-dynamic";

export default async function ExpenseClaimPayoutApprovalPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const row = await getExpenseClaimPayoutApprovalByToken(token);

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

  const { approval, claim, orgRow } = row;
  const destLabel = approval.destinationType === "phone" ? "Mobile number" : approval.destinationType === "till" ? "Till number" : "Paybill";

  return (
    <div className="min-h-screen bg-[var(--color-ink-50)] px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">Expense claim payout — approval needed</div>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">{claim.submittedByName}&apos;s reimbursement</h1>
          <p className="mt-1 text-[13px] text-[var(--color-ink-500)]">
            {approval.requestedByName} wants to pay this out — {orgRow.name} requires your approval above the configured limit.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-[var(--color-ink-100)] p-4">
            <div className="col-span-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">For</div>
              <div className="mt-1 text-[14px] font-medium">{claim.description}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Amount</div>
              <div className="mt-1 text-[14px] font-medium">{fmtKES(approval.amountCents)}</div>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Claim date</div>
              <div className="mt-1 text-[14px] font-medium">{claim.date}</div>
            </div>
            <div className="col-span-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">{destLabel}</div>
              <div className="mt-1 text-[14px] font-medium">
                {approval.destination}
                {approval.accountNumber ? ` · Acct: ${approval.accountNumber}` : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ExpenseClaimPayoutApprovalClient token={token} />
        </div>

        <p className="text-center text-[12px] text-[var(--color-ink-400)]">
          Prefer to review it yourself first?{" "}
          <a href="/expense-claims" className="font-medium text-[var(--color-accent-600)] hover:underline">
            Open Expense Claims in Zeno
          </a>{" "}
          (sign-in required).
        </p>
      </div>
    </div>
  );
}
