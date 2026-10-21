"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDaysWorkedAction } from "../actions";

/** Days worked for one employee in a draft run; saving recalculates their payslip. */
export function DaysWorkedCell({
  runId,
  employeeId,
  daysWorked,
  workingDays,
}: {
  runId: number;
  employeeId: number;
  daysWorked: number;
  workingDays: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(daysWorked));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const n = Number(value);
    if (value.trim() === "" || n === daysWorked) {
      setValue(String(daysWorked));
      setError(null);
      return;
    }
    startTransition(async () => {
      const res = await setDaysWorkedAction(runId, employeeId, n);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-1.5">
        <input
          inputMode="decimal"
          aria-label="Days worked"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setValue(String(daysWorked));
              setError(null);
            }
          }}
          className={`w-16 rounded-md border px-2 py-1 text-right text-[13px] tnum outline-none focus:border-[var(--color-accent-500)] disabled:opacity-60 ${
            error ? "border-[var(--color-bad)]" : "border-[var(--color-ink-200)]"
          }`}
        />
        <span className="text-[12px] text-[var(--color-ink-400)] whitespace-nowrap">of {workingDays}</span>
      </div>
      {error && <span className="max-w-[220px] text-right text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
