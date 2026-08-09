"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reconcileOrgPayoutsAction } from "@/app/(app)/sales/payments/events/actions";

/** Kopo Kopo's webhook has been observed never confirming a payout in
 *  production — this actively asks Kopo Kopo's own API for the real status
 *  of every "applied" payout that's still showing the placeholder reference,
 *  instead of waiting on a callback that may not arrive at all. */
export function ReconcileButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-[12px] text-[var(--color-ink-500)]">{result}</span>}
      {error && <span className="text-[12px] text-[var(--color-bad)]">{error}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            setError(null);
            try {
              const res = await reconcileOrgPayoutsAction();
              setResult(`${res.checked} checked · ${res.confirmed} confirmed · ${res.reversed} reversed · ${res.stillPending} still processing`);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not check payout status");
            }
          })
        }
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2"
      >
        {pending ? "Checking…" : "Check Kopo Kopo payout status now"}
      </button>
    </div>
  );
}
