"use client";

import { useMemo, useState } from "react";
import { fmtKES } from "@/lib/money";
import { TAX_CLASSES, type TaxClass } from "@/lib/tax";
import { TableCard, Th, Td } from "@/components/ui";
import { StockAdjust } from "@/components/StockAdjust";

interface ItemRow {
  id: number;
  name: string;
  sku: string | null;
  kind: string;
  taxClass: string;
  salePriceCents: number;
  unit: string;
  trackInventory: boolean;
  reorderLevel: number;
}

export function ItemsTable({ rows, stock }: { rows: ItemRow[]; stock: Record<number, { qty: number; value: number }> }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (it) => it.name.toLowerCase().includes(needle) || (it.sku ?? "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search items by name or SKU…"
        className="w-full max-w-sm rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mb-3"
      />
      <TableCard>
        <thead className="hairline-b">
          <tr>
            <Th>Item</Th>
            <Th>VAT</Th>
            <Th right>Selling price</Th>
            <Th right>In stock</Th>
            <Th right>Stock value</Th>
            <Th>Adjust</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((it) => {
            const qty = it.trackInventory ? stock[it.id]?.qty ?? 0 : null;
            const low = qty !== null && it.reorderLevel > 0 && qty <= it.reorderLevel;
            return (
              <tr key={it.id} className="hairline-t">
                <Td>
                  <span className="font-medium">{it.name}</span>
                  {it.sku && <span className="text-[var(--color-ink-400)]"> · {it.sku}</span>}
                  <div className="text-[11px] text-[var(--color-ink-400)] capitalize">{it.kind}</div>
                </Td>
                <Td className="text-[var(--color-ink-600)]">
                  {TAX_CLASSES[it.taxClass as TaxClass]?.label ?? it.taxClass}
                </Td>
                <Td right>{fmtKES(it.salePriceCents)}</Td>
                <Td right>
                  {qty === null ? (
                    <span className="text-[var(--color-ink-400)]">—</span>
                  ) : (
                    <span className={low ? "text-[var(--color-bad)] font-semibold" : ""}>
                      {qty} {it.unit}
                      {low && " ⚠︎"}
                    </span>
                  )}
                </Td>
                <Td right>{it.trackInventory ? fmtKES(stock[it.id]?.value ?? 0) : "—"}</Td>
                <Td>{it.trackInventory && <StockAdjust itemId={it.id} unit={it.unit} />}</Td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-3 text-[13px] text-[var(--color-ink-400)]">
                No items match &quot;{q}&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </>
  );
}
