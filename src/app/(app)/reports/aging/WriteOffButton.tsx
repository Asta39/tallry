"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { writeOffInvoice } from "@/lib/phase-a-actions";

/** Writes off a badly-overdue invoice's unpaid balance as bad debt, from the Aging report. */
export function WriteOffButton({ invoiceId, balanceLabel }: { invoiceId: number; balanceLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function writeOff() {
    if (!confirm(`Write off the unpaid ${balanceLabel} as bad debt? This posts to the ledger and can't be undone here.`)) return;
    setError(null);
    start(async () => {
      try {
        await writeOffInvoice(invoiceId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Write-off failed");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={writeOff}
        disabled={pending}
        className="text-[12px] font-medium text-[var(--color-bad)] hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Writing off…" : "Write off"}
      </button>
      {error && <span className="text-[10px] text-[var(--color-bad)]">{error}</span>}
    </span>
  );
}
