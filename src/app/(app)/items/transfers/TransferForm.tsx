"use client";

import { useEffect, useState, useTransition } from "react";
import { todayISO } from "@/lib/money";
import { transferStockAction, getItemStockByWarehouse } from "@/lib/warehouses";

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function TransferForm({ items, warehouses }: { items: { id: number; name: string }[]; warehouses: { id: number; name: string }[] }) {
  const [itemId, setItemId] = useState<number | "">("");
  const [fromWarehouseId, setFromWarehouseId] = useState<number | "">(warehouses[0]?.id ?? "");
  const [toWarehouseId, setToWarehouseId] = useState<number | "">(warehouses[1]?.id ?? "");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setAvailableQty(null);
    if (!itemId || !fromWarehouseId) return;
    getItemStockByWarehouse(Number(itemId)).then((rows) => {
      const row = rows.find((r) => r.warehouseId === fromWarehouseId);
      setAvailableQty(row?.qty ?? 0);
    });
  }, [itemId, fromWarehouseId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!itemId) return setError("Choose an item");
    if (!fromWarehouseId || !toWarehouseId) return setError("Choose both warehouses");
    if (fromWarehouseId === toWarehouseId) return setError("Source and destination must differ");
    const qtyNum = parseFloat(qty);
    if (!qtyNum || qtyNum <= 0) return setError("Enter a quantity greater than zero");

    startTransition(async () => {
      try {
        await transferStockAction({
          itemId: Number(itemId),
          fromWarehouseId: Number(fromWarehouseId),
          toWarehouseId: Number(toWarehouseId),
          qty: qtyNum,
          date: todayISO(),
          note: note || undefined,
        });
        setSuccess(true);
        setQty("");
        setNote("");
        setTimeout(() => window.location.reload(), 800);
      } catch (e: any) {
        setError(e.message || "Could not transfer stock");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-5 flex flex-wrap items-end gap-3">
      <label className="min-w-[200px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Item</span>
        <select value={itemId} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")} required className={inputCls + " w-full mt-1"}>
          <option value="" disabled>Select item…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </label>
      <label>
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">From</span>
        <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value ? Number(e.target.value) : "")} className={inputCls + " mt-1"}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        {availableQty !== null && <div className="text-[11px] text-[var(--color-ink-400)] mt-1">{availableQty} on hand</div>}
      </label>
      <label>
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">To</span>
        <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value ? Number(e.target.value) : "")} className={inputCls + " mt-1"}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <label className="w-28">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Qty</span>
        <input type="number" step="any" value={qty} onChange={(e) => setQty(e.target.value)} required className={inputCls + " w-full mt-1"} />
      </label>
      <label className="flex-1 min-w-[160px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Note (optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls + " w-full mt-1"} />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
        {pending ? "Transferring…" : "Transfer"}
      </button>
      {error && <p className="w-full text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      {success && <p className="w-full text-[12.5px] text-[var(--color-good)]">Transferred.</p>}
    </form>
  );
}
