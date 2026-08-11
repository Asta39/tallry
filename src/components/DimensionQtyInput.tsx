"use client";

import { useState } from "react";

const cls =
  "w-full rounded-md border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] bg-transparent px-2 py-1.5 text-[13px] outline-none text-right";

/** Qty entry for an item that's measured by area (width × height) instead of
 *  counted or entered as a single length — e.g. a board cut to size. Keeps
 *  the underlying qty a single number (width × height, in the item's own
 *  unit) so nothing downstream (FIFO, BOM, totals) needs to know dimensions
 *  exist; this is purely a data-entry convenience. */
export function DimensionQtyInput({
  measurementType,
  unit,
  value,
  onChange,
  compact,
}: {
  measurementType?: string | null;
  unit?: string;
  value: string;
  onChange: (qty: string) => void;
  /** Tighter layout for table cells where two stacked inputs don't fit width-wise. */
  compact?: boolean;
}) {
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  if (measurementType === "area") {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    const computed = w > 0 && h > 0 ? w * h : null;
    return (
      <div className={compact ? "space-y-1" : "flex items-center gap-1.5"}>
        <div className="flex items-center gap-1">
          <input
            className={cls}
            placeholder="Width"
            value={width}
            onChange={(e) => {
              setWidth(e.target.value);
              const w2 = Number(e.target.value) || 0;
              const h2 = Number(height) || 0;
              if (w2 > 0 && h2 > 0) onChange(String(w2 * h2));
            }}
          />
          <span className="text-[var(--color-ink-300)] text-[12px]">×</span>
          <input
            className={cls}
            placeholder="Height"
            value={height}
            onChange={(e) => {
              setHeight(e.target.value);
              const h2 = Number(e.target.value) || 0;
              const w2 = Number(width) || 0;
              if (w2 > 0 && h2 > 0) onChange(String(w2 * h2));
            }}
          />
        </div>
        <div className="text-[11px] text-[var(--color-ink-400)] whitespace-nowrap">
          {computed !== null
            ? `= ${computed} ${unit || ""}`
            : value && Number(value) > 0
              ? `currently ${value} ${unit || ""} — enter width × height to change`
              : `${unit || ""}²`}
        </div>
      </div>
    );
  }

  return (
    <input
      className={cls}
      placeholder={measurementType === "length" ? unit || "length" : "0"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
