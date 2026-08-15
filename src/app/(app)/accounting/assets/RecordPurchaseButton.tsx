"use client";

import { useState } from "react";
import { recordAssetPurchaseAction } from "./actions";

export function RecordPurchaseButton({
  assetId,
  banks,
}: {
  assetId: number;
  banks: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bankId, setBankId] = useState<number | "">(banks[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline">
        Record purchase
      </button>
    );
  }

  async function handleRecord() {
    setError(null);
    if (!bankId) { setError("Select which account paid for this"); return; }
    setLoading(true);
    try {
      const res = await recordAssetPurchaseAction(assetId, bankId, date);
      if (res.error) throw new Error(res.error);
      window.location.reload();
    } catch (e: any) {
      setError(e.message || "Failed to record purchase");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "rounded-md border border-[var(--color-ink-200)] bg-white px-2 py-1 text-[12px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";

  return (
    <div className="flex flex-col items-end gap-1.5 py-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <select value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
          <option value="">Paid from…</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button disabled={loading} onClick={handleRecord} className="text-[11.5px] font-medium text-[var(--color-accent-600)] hover:underline disabled:opacity-50">
          {loading ? "Working…" : "Confirm"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
