"use client";

import { useState, useTransition } from "react";
import { reconcileExpenseClaimAccountAction } from "@/lib/expense-claims";
import { fmtKES } from "@/lib/money";

export function ExpenseClaimAccountBanner({ count, totalCents }: { count: number; totalCents: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (count === 0 || dismissed) return null;

  return (
    <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 flex items-center justify-between gap-4">
      <div>
        <span className="font-medium">{count} open expense claim{count === 1 ? "" : "s"} ({fmtKES(totalCents)})</span>{" "}
        are sitting in Accounts Payable instead of Staff Reimbursements Payable — a code bug that's now fixed for
        new claims. Move the existing balance over?
        {error && <div className="text-[var(--color-bad)] mt-1">{error}</div>}
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await reconcileExpenseClaimAccountAction();
            if (res.error) setError(res.error);
            else setDismissed(true);
          })
        }
        className="shrink-0 rounded-lg bg-amber-800 hover:bg-amber-900 disabled:opacity-60 text-white text-[12.5px] font-medium px-3 py-1.5"
      >
        {pending ? "Fixing…" : "Fix now"}
      </button>
    </div>
  );
}
