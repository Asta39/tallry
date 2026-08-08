"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseKES } from "@/lib/money";
import { adjustStock } from "@/lib/actions";

/**
 * Inline stock adjustment. Soft-refreshes the table (no full page reload) and
 * shows errors inline instead of crashing to a white screen. Cost is optional —
 * a qty-only adjustment tracks stock with no ledger value.
 */
export function StockAdjust({ itemId, unit }: { itemId: number; unit: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [reasonType, setReasonType] = useState<"shrinkage" | "used_in_production">("shrinkage");
  const [error, setError] = useState<string | null>(null);

  const isConsumption = Number(qty) < 0;

  function submit() {
    setError(null);
    const q = Number(qty);
    if (!q || Number.isNaN(q)) {
      setError("Enter a quantity");
      return;
    }
    const c = parseKES(cost || "0") || 0;
    const reasonLabel = q < 0 && reasonType === "used_in_production" ? "used in production/job" : "manual adjustment";
    start(async () => {
      try {
        await adjustStock(itemId, q, c, reasonLabel, q < 0 ? reasonType : undefined);
        setQty("");
        setCost("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Adjustment failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex gap-1 items-center flex-wrap">
        <input
          name="qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={`±qty ${unit}`}
          className="w-16 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[12px]"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input
          name="cost"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="cost"
          className="w-16 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[12px]"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {isConsumption && (
          <select
            value={reasonType}
            onChange={(e) => setReasonType(e.target.value as "shrinkage" | "used_in_production")}
            className="rounded border border-[var(--color-ink-200)] px-1 py-1 text-[11px]"
            title="Where the cost of this consumed stock should post"
          >
            <option value="shrinkage">Shrinkage/damage</option>
            <option value="used_in_production">Used in production/job (COGS)</option>
          </select>
        )}
        <button
          onClick={submit}
          disabled={pending}
          className="text-[12px] text-[var(--color-accent-600)] font-medium px-1 disabled:opacity-50"
        >
          {pending ? "…" : "OK"}
        </button>
      </div>
      {error && <span className="text-[10.5px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}
