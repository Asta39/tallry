"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBooksLock } from "@/lib/phase-a-actions";

export function PeriodLockForm({ currentLockDate }: { currentLockDate: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    const lockDate = String(formData.get("lockDate") || "").trim();

    start(async () => {
      try {
        await setBooksLock(lockDate || null);
        router.push("/accountant");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update books lock.");
      }
    });
  }

  return (
    <form action={action} className="space-y-4">
      {error && <div className="p-3 bg-red-50 text-[var(--color-bad)] text-[13px] rounded-lg">{error}</div>}
      
      <p className="text-[13px] text-[var(--color-ink-600)] mb-4">
        Journal entries dated on or before the lock date cannot be modified, deleted, or created. This ensures historical integrity after a year-end close or tax filing.
      </p>

      <div>
        <label className="block text-[13px] font-medium text-[var(--color-ink-700)] mb-1">
          Lock Date (YYYY-MM-DD)
        </label>
        <input
          type="date"
          name="lockDate"
          defaultValue={currentLockDate || ""}
          className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
        />
        <p className="text-[12px] text-[var(--color-ink-400)] mt-1">Leave blank to unlock the books completely.</p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[var(--color-accent-500)] text-white px-4 py-2 text-[13px] font-medium hover:bg-[var(--color-accent-600)] transition-colors disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save Lock Date"}
        </button>
      </div>
    </form>
  );
}
