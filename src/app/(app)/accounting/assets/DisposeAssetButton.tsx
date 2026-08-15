"use client";

import { useState } from "react";
import { disposeAssetAction } from "./actions";

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

  async function handleDispose() {
    setError(null);
    const proceedsCents = Math.round((parseFloat(proceeds) || 0) * 100);
    if (proceedsCents > 0 && !bankId) { setError("Select which account received the proceeds"); return; }
    if (!confirm(`Dispose of "${assetName}"? This removes it from the asset register and posts a disposal entry — it can't be undone.`)) return;
    setLoading(true);
    try {
      const res = await disposeAssetAction(assetId, date, proceedsCents, bankId === "" ? undefined : bankId);
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
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <input
          type="number"
          min="0"
          step="0.01"
          value={proceeds}
          onChange={(e) => setProceeds(e.target.value)}
          placeholder="Proceeds (KSh)"
          className={`${inputCls} w-28`}
        />
        {parseFloat(proceeds) > 0 && banks.length > 0 && (
          <select value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button disabled={loading} onClick={handleDispose} className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50">
          {loading ? "Working…" : "Confirm dispose"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
