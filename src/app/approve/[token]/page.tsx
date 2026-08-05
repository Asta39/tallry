import { getApprovalRequestByToken, getApprovalRequestAnyState } from "@/lib/spend-approvals";
import { fmtKES } from "@/lib/money";
import { db, documentLines, accounts, costCenters } from "@/db";
import { eq } from "drizzle-orm";
import { ApprovalRequestClient } from "./ApprovalRequestClient";

export const dynamic = "force-dynamic";

export default async function ApprovalRequestPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const pendingRow = await getApprovalRequestByToken(token);
  // Once approved, the document is no longer "pending_approval" so the lookup
  // above returns null — fall back to the any-state lookup so a bill's Pay
  // step (and a clear "already handled" message otherwise) still has
  // something to show instead of a dead end.
  const row = pendingRow || (await getApprovalRequestAnyState(token));

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

  const isPayable = row.doc.type === "bill" && row.req.decision === "approved" && row.doc.paidCents < row.doc.totalCents;

  const lines = await db
    .select({
      description: documentLines.description,
      qty: documentLines.qty,
      grossCents: documentLines.grossCents,
      accountName: accounts.name,
      costCenterName: costCenters.name,
    })
    .from(documentLines)
    .leftJoin(accounts, eq(documentLines.accountId, accounts.id))
    .leftJoin(costCenters, eq(documentLines.costCenterId, costCenters.id))
    .where(eq(documentLines.documentId, row.doc.id));

  const appPath = row.doc.type === "bill" ? `/purchases/bills/${row.doc.id}` : `/purchases/expenses/${row.doc.id}`;

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
              <div className="mt-1 text-[14px] font-medium">
                {row.doc.status === "pending_approval" ? "Awaiting approval" : row.doc.status === "paid" ? "Paid" : row.req.decision === "rejected" ? "Rejected" : "Approved"}
              </div>
            </div>
            {row.doc.type === "bill" && row.doc.payoutDestination && (
              <div className="col-span-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Pay to</div>
                <div className="mt-1 text-[14px] font-medium">
                  {row.doc.payoutDestinationType === "phone" ? "Mobile" : row.doc.payoutDestinationType === "till" ? "Till" : "Paybill"} {row.doc.payoutDestination}
                  {row.doc.payoutAccountNumber ? ` · Acct: ${row.doc.payoutAccountNumber}` : ""}
                </div>
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)] mb-2">What this is for</div>
              <div className="rounded-xl border border-[var(--color-ink-100)] divide-y divide-[var(--color-ink-100)]">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 text-[13px]">
                    <div>
                      <div className="font-medium">{l.description}</div>
                      <div className="text-[11.5px] text-[var(--color-ink-400)]">
                        {l.qty} × · {l.accountName ?? "Uncategorized"}{l.costCenterName ? ` · ${l.costCenterName}` : ""}
                      </div>
                    </div>
                    <div className="tnum shrink-0">{fmtKES(l.grossCents)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ApprovalRequestClient
            token={token}
            initialStatus={row.doc.status}
            isPayable={isPayable}
            outstandingCents={row.doc.totalCents - row.doc.paidCents}
            payoutDestination={row.doc.payoutDestination}
            payoutDestinationType={row.doc.payoutDestinationType}
          />
        </div>

        <p className="text-center text-[12px] text-[var(--color-ink-400)]">
          Want to review the full history or pay this yourself?{" "}
          <a href={appPath} className="font-medium text-[var(--color-accent-600)] hover:underline">
            Open in Zeno
          </a>{" "}
          (sign-in required — this link works without one, but moving money does not).
        </p>
      </div>
    </div>
  );
}
