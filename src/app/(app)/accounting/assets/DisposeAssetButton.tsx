"use client";

import { useState } from "react";
import { disposeAssetAction, type DisposalType } from "./actions";

const DISPOSAL_OPTIONS: { value: DisposalType; label: string }[] = [
  { value: "sale", label: "Sold" },
  { value: "scrap", label: "Scrapped / written off" },
  { value: "trade", label: "Traded in" },
];

export function DisposeAssetButton({
  assetId,
  assetName,
  banks,
}: {
  assetId: number;
  assetName: string;
  banks: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [disposalType, setDisposalType] = useState<DisposalType>("sale");
  const [proceeds, setProceeds] = useState("0");
  const [bankId, setBankId] = useState<number | "">(banks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline">
        Dispose
      </button>
    );
  }

  const proceedsCents = Math.round((parseFloat(proceeds) || 0) * 100);
  const showProceeds = disposalType !== "scrap";

  async function handleDispose() {
    setError(null);
    if (showProceeds && proceedsCents > 0 && !bankId) {
      setError(disposalType === "trade" ? "Select which account received the trade-in value" : "Select which account received the proceeds");
      return;
    }
    if (!confirm(`${DISPOSAL_OPTIONS.find((o) => o.value === disposalType)?.label} "${assetName}"? This removes it from the asset register and posts a disposal entry — it can't be undone.`)) return;
    setLoading(true);
    try {
      const res = await disposeAssetAction(assetId, date, disposalType, showProceeds ? proceedsCents : 0, bankId === "" ? undefined : bankId);
      if (res.error) throw new Error(res.error);
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "Failed to dispose of asset");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "rounded-md border border-[var(--color-ink-200)] bg-white px-2 py-1 text-[12px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";

  return (
    <div className="flex flex-col items-end gap-1.5 py-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <select
          value={disposalType}
          onChange={(e) => {
            const v = e.target.value as DisposalType;
            setDisposalType(v);
            if (v === "scrap") setProceeds("0");
          }}
          className={inputCls}
        >
          {DISPOSAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        {showProceeds && (
          <input
            type="number"
            min="0"
            step="0.01"
            value={proceeds}
            onChange={(e) => setProceeds(e.target.value)}
            placeholder={disposalType === "trade" ? "Trade-in value (KSh)" : "Proceeds (KSh)"}
            className={`${inputCls} w-32`}
          />
        )}
        {showProceeds && proceedsCents > 0 && banks.length > 0 && (
          <select value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            <option value="">Proceeds directed to…</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button disabled={loading} onClick={handleDispose} className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50">
          {loading ? "Working…" : "Confirm"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
