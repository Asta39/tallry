"use client";

import { useState, useTransition } from "react";
import { setItemBomAction } from "@/lib/item-bom";
import { DimensionQtyInput } from "@/components/DimensionQtyInput";
import { Tooltip } from "@/components/Tooltip";

type Row = { componentItemId: number | ""; qtyPerUnit: string; wasteQtyPerUnit: string };

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

export function ItemBomEditor({
  parentItemId,
  parentName,
  options,
  initialRows,
}: {
  parentItemId: number;
  parentName: string;
  options: { id: number; name: string; unit?: string; measurementType?: string | null }[];
  initialRows: { componentItemId: number; qtyPerUnit: number; wasteQtyPerUnit: number }[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialRows.length > 0
      ? initialRows.map((r) => ({ componentItemId: r.componentItemId, qtyPerUnit: String(r.qtyPerUnit), wasteQtyPerUnit: String(r.wasteQtyPerUnit) }))
      : []
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addRow() {
    setRows((rs) => [...rs, { componentItemId: options[0]?.id ?? "", qtyPerUnit: "1", wasteQtyPerUnit: "0" }]);
  }
  function updateRow(i: number, patch: Partial<Row>) {
    setSaved(false);
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setSaved(false);
    setRows((rs) => rs.filter((_, j) => j !== i));
  }

  function save() {
    setError(null);
    setSaved(false);
    const parsed = rows
      .filter((r) => r.componentItemId !== "")
      .map((r) => ({
        componentItemId: Number(r.componentItemId),
        qtyPerUnit: Number(r.qtyPerUnit) || 0,
        wasteQtyPerUnit: Number(r.wasteQtyPerUnit) || 0,
      }));
    start(async () => {
      const res = await setItemBomAction(parentItemId, parsed);
      if (res.error) setError(res.error);
      else setSaved(true);
    });
  }

  if (options.length === 0 && rows.length === 0) {
    return (
      <p className="text-[12.5px] text-[var(--color-ink-400)]">
        No tracked-inventory items available yet to use as components — mark at least one other item as stock-tracked first.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--color-ink-500)]">
        List what {parentName || "this product"} is made from. Selling it consumes each component&apos;s own FIFO stock instead of
        this item&apos;s (it carries no stock of its own). &quot;Waste&quot; is unusable offcut consumed alongside the usable amount —
        physically taken from stock the same way, but costed to a separate Production Waste account so it&apos;s visible instead of
        hidden inside product cost.
      </p>

      {rows.length > 0 && (
        <div className="rounded-lg border border-[var(--color-ink-200)] overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead className="bg-[var(--color-ink-50)]">
              <tr>
                <th className="text-left px-2.5 py-2 font-medium">Component</th>
                <th className="text-right px-2.5 py-2 font-medium w-28">Qty per unit</th>
                <th className="text-right px-2.5 py-2 font-medium w-28">Waste per unit</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const component = options.find((o) => o.id === r.componentItemId);
                return (
                  <tr key={i} className="hairline-t">
                    <td className="px-2.5 py-1.5">
                      <select
                        className={inputCls}
                        value={r.componentItemId}
                        onChange={(e) => updateRow(i, { componentItemId: e.target.value ? Number(e.target.value) : "" })}
                      >
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <DimensionQtyInput
                        measurementType={component?.measurementType}
                        unit={component?.unit}
                        value={r.qtyPerUnit}
                        onChange={(v) => updateRow(i, { qtyPerUnit: v })}
                        compact
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <DimensionQtyInput
                        measurementType={component?.measurementType}
                        unit={component?.unit}
                        value={r.wasteQtyPerUnit}
                        onChange={(v) => updateRow(i, { wasteQtyPerUnit: v })}
                        compact
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Tooltip text="Remove component">
                        <button type="button" onClick={() => removeRow(i)} className="text-[var(--color-ink-300)] hover:text-[var(--color-bad)] text-[15px]" aria-label="Remove component">×</button>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={addRow} className="text-[12.5px] font-medium text-[var(--color-accent-600)] hover:text-[var(--color-accent-700)]">
          + Add component
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[12.5px] font-medium px-3.5 py-1.5"
          >
            {pending ? "Saving…" : "Save Bill of Materials"}
          </button>
        )}
        {saved && <span className="text-[12.5px] text-[var(--color-good)]">Saved</span>}
      </div>
      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}
    </div>
  );
}
