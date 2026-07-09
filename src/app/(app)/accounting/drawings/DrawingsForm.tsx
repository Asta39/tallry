"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordDrawings } from "@/lib/phase-a-actions";
import { parseKES } from "@/lib/money";

export function DrawingsForm({ banks }: { banks: { id: number; name: string; kind: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    const bankId = Number(formData.get("bankId"));
    const amt = parseKES(String(formData.get("amount") || ""));
    const memo = String(formData.get("memo") || "Owner drawings");

    if (!bankId) return setError("Select an account.");
    if (amt <= 0) return setError("Enter a valid amount.");

    start(async () => {
      try {
        await recordDrawings(bankId, amt, memo);
        router.push("/accountant");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to record drawings.");
      }
    });
  }

  return (
    <form action={action} className="space-y-4">
      {error && <div className="p-3 bg-red-50 text-[var(--color-bad)] text-[13px] rounded-lg">{error}</div>}
      
      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-700)] mb-1">
          Withdrawn from
        </label>
        <select
          name="bankId"
          className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
          required
        >
          <option value="">Select account...</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.kind})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-700)] mb-1">
          Amount
        </label>
        <input
          type="number"
          name="amount"
          step="0.01"
          min="0.01"
          required
          className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-700)] mb-1">
          Memo
        </label>
        <input
          type="text"
          name="memo"
          className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
          defaultValue="Owner drawings"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--color-accent-500)] text-white px-4 py-2 text-[13px] font-medium hover:bg-[var(--color-accent-600)] transition-colors disabled:opacity-50"
        >
          {pending ? "Recording..." : "Record Drawings"}
        </button>
      </div>
    </form>
  );
}
