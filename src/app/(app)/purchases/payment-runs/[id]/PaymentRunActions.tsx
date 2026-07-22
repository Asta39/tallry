"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { postPaymentRunAction, deletePaymentRunAction } from "@/lib/payment-runs";

export function PaymentRunActions({ runId, status }: { runId: number; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (status !== "draft") {
    return <p className="text-[13px] text-[var(--color-ink-400)]">This run has been posted — payments were recorded individually against each bill.</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await postPaymentRunAction(runId);
              setResult(`Posted: ${res.succeeded} paid${res.failed > 0 ? `, ${res.failed} failed` : ""}.`);
              router.refresh();
            } catch (e: any) {
              setError(e.message || "Could not post payment run");
            }
          });
        }}
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13.5px] font-medium px-5 py-2.5 transition-colors"
      >
        {pending ? "Posting…" : "Post payment run"}
      </button>
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm("Delete this draft run?")) return;
          startTransition(async () => {
            await deletePaymentRunAction(runId);
            router.push("/purchases/payment-runs");
          });
        }}
        className="text-[13px] text-[var(--color-bad)] hover:underline disabled:opacity-50"
      >
        Delete draft
      </button>
      {error && <span className="text-[12.5px] text-[var(--color-bad)]">{error}</span>}
      {result && <span className="text-[12.5px] text-[var(--color-good)]">{result}</span>}
    </div>
  );
}
