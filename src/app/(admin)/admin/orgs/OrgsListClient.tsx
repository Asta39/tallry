"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImpersonateButton } from "./ImpersonateButton";
import { bulkExtendTrialAction } from "../actions";

interface OrgRow {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  crmEnabled: boolean | null;
  accountingEnabled: boolean | null;
  payrollEnabled: boolean | null;
  billing: { status: "trial" | "active" | "locked"; trialDaysLeft: number };
  rawBillingStatus: string | null;
}

export function OrgsListClient({ rows }: { rows: OrgRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [days, setDays] = useState("14");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[Number(id)]).map(Number), [selected]);
  const selectedCount = selectedIds.length;
  const allChecked = rows.length > 0 && selectedCount === rows.length;

  function toggle(id: number) {
    setSelected((cur) => ({ ...cur, [id]: !cur[id] }));
  }

  function toggleAll() {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(rows.map((r) => [r.id, true])));
  }

  function extendTrials() {
    setError(null);
    setResult(null);
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1) return setError("Enter a positive whole number of days");
    start(async () => {
      try {
        const res = await bulkExtendTrialAction(selectedIds, d);
        setResult(`Extended ${res.extended} org(s) by ${d}d${res.skipped > 0 ? ` — skipped ${res.skipped} non-trial org(s)` : ""}.`);
        setSelected({});
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not extend trials");
      }
    });
  }

  return (
    <div className="space-y-3">
      {selectedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] font-medium text-red-800">{selectedCount} selected</span>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-red-800">Extend trial by</span>
            <input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-16 rounded-md border border-red-200 bg-white px-2 py-1 text-[12.5px]"
            />
            <span className="text-[12.5px] text-red-800">days</span>
          </div>
          <button
            disabled={pending}
            onClick={extendTrials}
            className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[12.5px] font-medium px-3 py-1.5"
          >
            {pending ? "Applying…" : "Apply"}
          </button>
          <button onClick={() => setSelected({})} className="text-[12px] text-red-700 hover:underline">Clear selection</button>
          {error && <span className="text-[12px] text-[var(--color-bad)]">{error}</span>}
        </div>
      )}
      {result && <p className="text-[12.5px] text-[var(--color-good)]">{result}</p>}

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium w-8">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Modules</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={!!selected[o.id]} onChange={() => toggle(o.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{o.id}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/orgs/${o.id}`} className="hover:underline text-red-700">{o.name || "Unnamed Org"}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--color-ink-900)]">{o.email || "-"}</div>
                    <div className="text-xs text-[var(--color-ink-500)]">{o.phone || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      o.billing.status === "locked" ? "bg-red-100 text-red-800"
                        : o.billing.status === "trial" ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                    }`}>
                      {o.billing.status === "trial" ? `Trial · ${o.billing.trialDaysLeft}d left` : o.billing.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {([
                        ["CRM", o.crmEnabled],
                        ["Acct", o.accountingEnabled],
                        ["Payroll", o.payrollEnabled],
                      ] as const).map(([label, on]) => (
                        <span
                          key={label}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ${
                            on ? "bg-[var(--color-ink-100)] text-[var(--color-ink-700)]" : "bg-[var(--color-ink-50)] text-[var(--color-ink-300)] line-through"
                          }`}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-3">
                    <Link href={`/admin/orgs/${o.id}`} className="text-sm font-medium text-[var(--color-ink-600)] hover:underline">Details</Link>
                    <ImpersonateButton orgId={o.id} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-ink-500)]">
                    No organizations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
