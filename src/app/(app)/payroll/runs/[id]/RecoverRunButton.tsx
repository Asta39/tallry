"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recoverStuckPayrollRunAction } from "../actions";

/**
 * Only rendered for a run left in "posting" — the process died mid-post, so
 * neither the post form nor delete (both of which require "draft") can act on
 * it. The action decides which way to recover by looking for the journal entry.
 */
export function RecoverRunButton({ runId }: { runId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function recover() {
    setError(null);
    start(async () => {
      try {
        const res = await recoverStuckPayrollRunAction(runId);
        router.refresh();
        if (res.recovered === "completed_post") {
          alert("The journal entry had already posted — the run is now marked posted and loan balances have been applied.");
        } else {
          alert("Nothing had reached the ledger — the run is back to draft and can be posted again.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Recovery failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <p className="text-[12.5px] text-orange-700 max-w-xs text-right">
          This run was interrupted while posting. Recovering finishes the post if it
          reached the ledger, or returns it to draft if it didn&apos;t.
        </p>
        <button
          type="button"
          onClick={recover}
          disabled={pending}
          className="rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 whitespace-nowrap transition-colors"
        >
          {pending ? "Checking…" : "Recover this run"}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}
    </div>
  );
}
