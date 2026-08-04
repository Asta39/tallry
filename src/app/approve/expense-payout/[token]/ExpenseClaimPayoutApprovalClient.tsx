"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToExpenseClaimPayoutApprovalAction } from "@/lib/expense-claims";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function ExpenseClaimPayoutApprovalClient({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  function run(decision: "approved" | "rejected") {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await respondToExpenseClaimPayoutApprovalAction(token, decision, rejectNote);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setSuccess(decision === "approved" ? "Payout sent — it will be recorded once the gateway confirms." : "Payout request rejected.");
      router.refresh();
    });
  }

  if (success) {
    return <p className="text-[13px] text-[var(--color-good)]">{success}</p>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-[var(--color-bad)]">{error}</div>}

      <div className="flex flex-wrap gap-3">
        <button
          disabled={pending}
          onClick={() => {
            if (!confirm("Approve and send this payout now? Real money will be moved immediately.")) return;
            run("approved");
          }}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
        >
          {pending ? "Working…" : "Approve & pay"}
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
              placeholder="Add a note"
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
