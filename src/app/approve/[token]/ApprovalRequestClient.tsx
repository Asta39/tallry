"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToApprovalRequestAction, payApprovedBillGatewayAction } from "@/lib/actions";
import { isStaleServerActionError, STALE_ACTION_MESSAGE } from "@/lib/stale-action";
import { fmtKES } from "@/lib/money";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function ApprovalRequestClient({
  token,
  initialStatus,
  isPayable,
  outstandingCents,
  payoutDestination,
  payoutDestinationType,
}: {
  token: string;
  initialStatus: string;
  isPayable?: boolean;
  outstandingCents?: number;
  payoutDestination?: string | null;
  payoutDestinationType?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [paid, setPaid] = useState(false);

  function run(decision: "approved" | "rejected") {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const res = await respondToApprovalRequestAction(token, decision, rejectNote);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setSuccess(decision === "approved" ? "Approved and posted." : "Document rejected successfully.");
        router.refresh();
      } catch (e) {
        setError(isStaleServerActionError(e) ? STALE_ACTION_MESSAGE : e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function runPay() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await payApprovedBillGatewayAction(token);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setPaid(true);
        setShowPayConfirm(false);
        router.refresh();
      } catch (e) {
        setError(isStaleServerActionError(e) ? STALE_ACTION_MESSAGE : e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (paid) {
    return <p className="text-[13px] text-[var(--color-good)] font-medium">Payment sent — {outstandingCents ? fmtKES(outstandingCents) : ""} to {payoutDestination}.</p>;
  }

  if (initialStatus !== "pending_approval") {
    if (isPayable) {
      return (
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-[var(--color-bad)] flex items-center gap-2">
              {error}
              {error === STALE_ACTION_MESSAGE && (
                <button onClick={() => window.location.reload()} className="underline font-medium shrink-0">Refresh</button>
              )}
            </div>
          )}
          <p className="text-[13px] text-[var(--color-ink-500)]">This bill is approved and posted, but hasn't been paid yet.</p>
          {!showPayConfirm ? (
            <button
              disabled={pending}
              onClick={() => setShowPayConfirm(true)}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              Pay {outstandingCents ? fmtKES(outstandingCents) : ""}
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-[var(--color-ink-100)] bg-[var(--color-ink-50)] p-4">
              <p className="text-[13px] text-[var(--color-ink-700)]">
                Send <span className="font-semibold">{outstandingCents ? fmtKES(outstandingCents) : ""}</span> to{" "}
                <span className="font-semibold">{payoutDestination}</span> ({payoutDestinationType})? This moves real money and can't be undone.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={pending}
                  onClick={runPay}
                  className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
                >
                  {pending ? "Sending…" : "Confirm & send"}
                </button>
                <button onClick={() => setShowPayConfirm(false)} className="text-[13px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
              </div>
            </div>
          )}
        </div>
      );
    }
    if (initialStatus === "paid") {
      return <p className="text-[13px] text-[var(--color-good)] font-medium">Approved and paid in full.</p>;
    }
    return <p className="text-[13px] text-[var(--color-ink-500)]">This approval request has already been handled.</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-[var(--color-bad)] flex items-center gap-2">
          {error}
          {error === STALE_ACTION_MESSAGE && (
            <button onClick={() => window.location.reload()} className="underline font-medium shrink-0">Refresh</button>
          )}
        </div>
      )}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-[var(--color-good)]">{success}</div>}

      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={() => run("approved")}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
        >
          {pending ? "Working…" : "Approve & post"}
        </button>
        <button
          disabled={pending}
          onClick={() => setShowReject((v) => !v)}
          className="rounded-lg border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 text-[var(--color-bad)] text-[13px] font-medium px-4 py-2 transition-colors"
        >
          Reject
        </button>
      </div>

      {showReject && (
        <div className="space-y-3 rounded-xl border border-[var(--color-ink-100)] bg-[var(--color-ink-50)] p-4">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reason (optional)</span>
            <input
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder="Add a note for the submitter"
            />
          </label>
          <button
            disabled={pending}
            onClick={() => run("rejected")}
            className="rounded-lg bg-[var(--color-bad)] hover:opacity-90 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
          >
            {pending ? "Working…" : "Confirm rejection"}
          </button>
        </div>
      )}
    </div>
  );
}
