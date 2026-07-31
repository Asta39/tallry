"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createEmployeeAction } from "../actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all mt-1.5";
const labelCls = "block text-[12px] font-medium text-[var(--color-ink-700)]";

export function EmployeeForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      try {
        await createEmployeeAction(formData);
        router.push("/payroll/employees");
        router.refresh();
      } catch (e) {
        // Next's redirect() (e.g. from a requirePerm() check inside the action)
        // throws a control-flow signal tagged with a NEXT_REDIRECT digest, not
        // a real error — must rethrow so Next's own boundary handles the
        // navigation, or it renders as an opaque crash instead of redirecting.
        if (e && typeof e === "object" && "digest" in e && typeof (e as any).digest === "string" && (e as any).digest.startsWith("NEXT_REDIRECT")) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Could not save employee");
      }
    });
  }

  return (
    <form action={submit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[var(--color-bad)]">
          {error}
        </div>
      )}

      {/* Section 1: Basic Information */}
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] pb-2 border-b border-[var(--color-ink-100)]">
          Personal & Compensation Details
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Full Name <span className="text-red-500">*</span>
            </label>
            <input name="name" type="text" className={inputCls} required placeholder="e.g. Wanjiku Kimani" />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>
              Basic Monthly Salary (KES) <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1.5">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-ink-400)]">
                KES
              </span>
              <input
                name="basicSalary"
                type="number"
                step="0.01"
                min="0"
                className={`${inputCls} mt-0 pl-14 font-mono font-medium`}
                required
                placeholder="50000.00"
              />
            </div>
            <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
              Gross monthly basic pay before PAYE, NSSF, and SHIF deductions.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Statutory Numbers */}
      <div className="space-y-4 pt-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-400)] pb-2 border-b border-[var(--color-ink-100)]">
          Kenya Statutory Identifiers (KRA, NSSF, SHIF)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>KRA PIN Number</label>
            <input
              name="kraPin"
              type="text"
              className={`${inputCls} uppercase font-mono`}
              placeholder="A000000000Z"
              maxLength={11}
              pattern="[A-Za-z]\d{9}[A-Za-z]"
              title="Format: A123456789Z"
            />
            <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
              Optional for now — needed later for monthly P9 returns & PAYE submission.
            </p>
          </div>

          <div>
            <label className={labelCls}>NSSF Number</label>
            <input name="nssfNumber" type="text" className={`${inputCls} font-mono`} placeholder="e.g. 123456789" />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>SHIF Number (Social Health Authority)</label>
            <input name="shifNumber" type="text" className={`${inputCls} font-mono`} placeholder="e.g. SHIF-987654" />
            <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
              Replaces NHIF for 2.75% mandatory healthcare contribution.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-ink-100)]">
        <Link
          href="/payroll/employees"
          className="px-4 py-2.5 text-xs font-semibold text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] rounded-lg transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 text-xs font-semibold text-white bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] disabled:opacity-50 rounded-lg transition-colors shadow-xs cursor-pointer"
        >
          {pending ? "Saving…" : "Save Employee Record"}
        </button>
      </div>
    </form>
  );
}
