"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBooksLock, reopenBooksLock, setAutoLockOnReconciliation } from "@/lib/phase-a-actions";
import type { AccountReconciledStatus } from "@/lib/period-lock";

export function PeriodLockForm({
  currentLockDate,
  autoLockOnReconciliation,
  accountStatuses,
}: {
  currentLockDate: string | null;
  autoLockOnReconciliation: boolean;
  accountStatuses: AccountReconciledStatus[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showReopen, setShowReopen] = useState(false);
  const [reopenDate, setReopenDate] = useState("");
  const [reason, setReason] = useState("");

  function extend(formData: FormData) {
    setError(null);
    const lockDate = String(formData.get("lockDate") || "").trim();
    start(async () => {
      try {
        await setBooksLock(lockDate || null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update books lock.");
      }
    });
  }

  function submitReopen() {
    if (!reason.trim()) {
      setError("Enter a reason for reopening this period.");
      return;
    }
    if (!confirm(`Reopen the books ${reopenDate ? `back to ${reopenDate}` : "completely"}? This lets historical entries be edited again. This is logged in the audit trail.`)) {
      return;
    }
    setError(null);
    start(async () => {
      try {
        await reopenBooksLock(reopenDate || null, reason);
        setShowReopen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to reopen the period.");
      }
    });
  }

  function toggleAutoLock(enabled: boolean) {
    setError(null);
    start(async () => {
      try {
        await setAutoLockOnReconciliation(enabled);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update auto-lock setting.");
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 text-[var(--color-bad)] text-[13px] rounded-lg">{error}</div>}

      <div>
        <p className="text-[13px] text-[var(--color-ink-600)] mb-3">
          Journal entries dated on or before the lock date cannot be modified, deleted, or created. This ensures
          historical integrity after a year-end close or tax filing.
        </p>
        <p className="text-[13px] font-medium text-[var(--color-ink-800)]">
          Currently {currentLockDate ? `locked through ${currentLockDate}` : "unlocked"}
        </p>
      </div>

      {/* Extend — forward only, no reason needed */}
      <form action={extend} className="space-y-2">
        <label className="block text-[13px] font-medium text-[var(--color-ink-700)]">Extend lock to</label>
        <div className="flex gap-2">
          <input type="date" name="lockDate" min={currentLockDate || undefined} className={inputCls} />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-lg bg-[var(--color-accent-500)] text-white px-4 py-2 text-[13px] font-medium hover:bg-[var(--color-accent-600)] transition-colors disabled:opacity-50"
          >
            {pending ? "Saving..." : "Extend"}
          </button>
        </div>
        <p className="text-[12px] text-[var(--color-ink-400)]">Must be on or after the current lock date.</p>
      </form>

      {/* Auto-lock toggle */}
      <div className="hairline-t pt-4">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoLockOnReconciliation}
            disabled={pending}
            onChange={(e) => toggleAutoLock(e.target.checked)}
            className="mt-0.5"
          />
          <span className="text-[13px] text-[var(--color-ink-700)]">
            Automatically lock a month once every bank and M-Pesa account is reconciled through it
          </span>
        </label>
      </div>

      {accountStatuses.length > 0 && (
        <div className="hairline-t pt-4">
          <p className="text-[12.5px] font-medium text-[var(--color-ink-600)] mb-2">Reconciled through, per account</p>
          <div className="space-y-1.5">
            {accountStatuses.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-ink-700)]">{a.name}</span>
                <span className={a.reconciledThrough ? "text-[var(--color-ink-500)]" : "text-orange-600 font-medium"}>
                  {a.reconciledThrough || "Never reconciled"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reopen — backward, requires a reason */}
      <div className="hairline-t pt-4">
        {!showReopen ? (
          <button
            type="button"
            onClick={() => setShowReopen(true)}
            disabled={!currentLockDate}
            className="text-[13px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            Reopen a locked period…
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
            <p className="text-[12.5px] text-[var(--color-ink-700)]">
              Moves the lock date earlier (or clears it entirely), letting historical entries be edited again.
              This is logged in the audit trail with the reason below.
            </p>
            <div>
              <label className="block text-[12px] font-medium text-[var(--color-ink-600)] mb-1">
                New lock date (leave blank to unlock completely)
              </label>
              <input
                type="date"
                value={reopenDate}
                max={currentLockDate || undefined}
                onChange={(e) => setReopenDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--color-ink-600)] mb-1">
                Reason (required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Correcting a misposted August bank fee found during review"
                className={inputCls}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitReopen}
                disabled={pending}
                className="rounded-lg bg-[var(--color-bad)] text-white px-4 py-2 text-[13px] font-medium disabled:opacity-50"
              >
                {pending ? "Reopening..." : "Reopen period"}
              </button>
              <button
                type="button"
                onClick={() => { setShowReopen(false); setError(null); }}
                disabled={pending}
                className="rounded-lg border border-[var(--color-ink-200)] px-4 py-2 text-[13px] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
