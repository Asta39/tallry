"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PERIOD_OPTIONS, type PeriodPreset } from "@/lib/report-period";

/**
 * Period + optional staff filter for the sales reports. Submits by pushing
 * search params, so the server page re-runs the report with the new range.
 */
export function ReportFilters({
  preset,
  from,
  to,
  staff,
  staffName,
}: {
  preset: PeriodPreset;
  from: string;
  to: string;
  /** When provided, renders a "Staff member" filter. */
  staff?: string[];
  staffName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [p, setP] = useState<PeriodPreset>(preset);
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [who, setWho] = useState(staffName ?? "");

  function apply() {
    // Start from the current query so params this component doesn't own —
    // notably the contact page's ?tab= — survive a period change.
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("period", p);
    if (p === "custom") {
      params.set("from", f);
      params.set("to", t);
    } else {
      params.delete("from");
      params.delete("to");
    }
    if (who) params.set("staff", who);
    else params.delete("staff");
    router.push(`${pathname}?${params.toString()}`);
  }

  const fieldCls =
    "w-full bg-white border border-[var(--color-ink-200)] text-[var(--color-ink-900)] text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] focus:border-[var(--color-accent-500)]";

  return (
    <div className="card p-5 mb-6 bg-[var(--color-ink-50)] border-dashed no-print">
      <div className="flex flex-col md:flex-row gap-4 md:items-end">
        <div className="md:w-56">
          <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Period</label>
          <select className={fieldCls} value={p} onChange={(e) => setP(e.target.value as PeriodPreset)}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {p === "custom" && (
          <>
            <div className="md:w-40">
              <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">From</label>
              <input type="date" className={fieldCls} value={f} onChange={(e) => setF(e.target.value)} />
            </div>
            <div className="md:w-40">
              <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">To</label>
              <input type="date" className={fieldCls} value={t} onChange={(e) => setT(e.target.value)} />
            </div>
          </>
        )}

        {staff && (
          <div className="md:w-56">
            <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Staff member</label>
            <select className={fieldCls} value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <button onClick={apply} className="btn-primary px-5 py-2 text-sm whitespace-nowrap">
          Update Report
        </button>
      </div>
    </div>
  );
}
