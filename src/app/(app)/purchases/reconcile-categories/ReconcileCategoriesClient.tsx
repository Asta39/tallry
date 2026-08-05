"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { reconcileSpendLineCategoryAction } from "@/lib/category-reconcile";
import { fmtKES } from "@/lib/money";

type Line = {
  lineId: number;
  documentId: number;
  description: string;
  netCents: number;
  docNumber: string;
  docDate: string;
};

export function ReconcileCategoriesClient({
  initialLines,
  categories,
  costCenters,
}: {
  initialLines: Line[];
  categories: { id: number; label: string }[];
  costCenters: { id: number; label: string }[];
}) {
  const [lines, setLines] = useState(initialLines);
  const [picks, setPicks] = useState<Record<number, { accountId: number | ""; costCenterId: number | "" }>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function setPick(lineId: number, patch: Partial<{ accountId: number | ""; costCenterId: number | "" }>) {
    setPicks((p) => {
      const current = p[lineId] || { accountId: "" as number | "", costCenterId: "" as number | "" };
      return { ...p, [lineId]: { ...current, ...patch } };
    });
  }

  function submit(line: Line) {
    const pick = picks[line.lineId];
    if (!pick?.accountId) {
      setErrorId(line.lineId);
      setError("Pick a category first");
      return;
    }
    if (costCenters.length > 0 && !pick.costCenterId) {
      setErrorId(line.lineId);
      setError("Pick a cost center first");
      return;
    }
    setError(null);
    setErrorId(null);
    setPendingId(line.lineId);
    startTransition(async () => {
      const res = await reconcileSpendLineCategoryAction(line.lineId, Number(pick.accountId), pick.costCenterId ? Number(pick.costCenterId) : null);
      setPendingId(null);
      if (res.error) {
        setErrorId(line.lineId);
        setError(res.error);
        return;
      }
      setLines((ls) => ls.filter((l) => l.lineId !== line.lineId));
    });
  }

  if (lines.length === 0) {
    return <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">Nothing to reconcile — every posted bill line has a category.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-[13px]">
        <thead className="hairline-b">
          <tr className="text-[11px] uppercase tracking-wide text-[var(--color-ink-400)]">
            <th className="px-4 py-2.5 font-semibold">Bill</th>
            <th className="px-3 py-2.5 font-semibold">Line</th>
            <th className="px-3 py-2.5 font-semibold text-right">Amount</th>
            <th className="px-3 py-2.5 font-semibold">Category</th>
            {costCenters.length > 0 && <th className="px-3 py-2.5 font-semibold">Cost center</th>}
            <th className="px-4 py-2.5 font-semibold" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {lines.map((l) => {
            const pick = picks[l.lineId] || { accountId: "", costCenterId: "" };
            return (
              <tr key={l.lineId}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <Link href={`/purchases/bills/${l.documentId}`} className="text-[var(--color-accent-600)] hover:underline">{l.docNumber}</Link>
                  <div className="text-[11px] text-[var(--color-ink-400)]">{l.docDate}</div>
                </td>
                <td className="px-3 py-2.5">{l.description}</td>
                <td className="px-3 py-2.5 text-right tnum font-medium">{fmtKES(l.netCents)}</td>
                <td className="px-3 py-2.5">
                  <select
                    className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 text-[12.5px] bg-white"
                    value={pick.accountId}
                    onChange={(e) => setPick(l.lineId, { accountId: e.target.value ? Number(e.target.value) : "" })}
                  >
                    <option value="">Select…</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </td>
                {costCenters.length > 0 && (
                  <td className="px-3 py-2.5">
                    <select
                      className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 text-[12.5px] bg-white"
                      value={pick.costCenterId}
                      onChange={(e) => setPick(l.lineId, { costCenterId: e.target.value ? Number(e.target.value) : "" })}
                    >
                      <option value="">Select…</option>
                      {costCenters.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </td>
                )}
                <td className="px-4 py-2.5 text-right">
                  <button
                    disabled={pendingId === l.lineId}
                    onClick={() => submit(l)}
                    className="text-[12px] font-medium text-white bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 rounded-md px-3 py-1.5"
                  >
                    {pendingId === l.lineId ? "Posting…" : "Assign"}
                  </button>
                  {errorId === l.lineId && error && <div className="text-[11px] text-[var(--color-bad)] mt-1">{error}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
