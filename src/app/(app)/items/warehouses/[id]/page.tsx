import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/guard";
import { getWarehouseDetail } from "@/lib/warehouses";
import { fmtKES } from "@/lib/money";
import { PageHeader, StatCard, TableCard, Th, Td, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("items");
  const { id } = await params;
  const detail = await getWarehouseDetail(Number(id));
  if (!detail) notFound();
  const { warehouse, items, totalValueCents } = detail;
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <>
      <Link href="/items/warehouses" className="text-[13px] text-[var(--color-ink-400)] hover:underline">
        ← Warehouses
      </Link>
      <PageHeader
        title={warehouse.name}
        subtitle={warehouse.isDefault ? "Default warehouse" : "Stock location"}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="card px-5 py-4">
          <div className="text-[12.5px] text-[var(--color-ink-600)]">Distinct items</div>
          <div className="money-lg mt-1">{items.length}</div>
        </div>
        <div className="card px-5 py-4">
          <div className="text-[12.5px] text-[var(--color-ink-600)]">Total units on hand</div>
          <div className="money-lg mt-1">{totalQty}</div>
        </div>
        <StatCard label="Stock value (FIFO cost)" cents={totalValueCents} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="No stock here yet" body="Items land in this warehouse via a bill line, opening stock, or a transfer from another warehouse." />
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Item</Th>
              <Th right>Qty on hand</Th>
              <Th right>Stock value</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.itemId} className="hairline-t">
                <Td>
                  <span className="font-medium">{it.name}</span>
                  {it.sku && <span className="text-[var(--color-ink-400)]"> · {it.sku}</span>}
                </Td>
                <Td right>{it.qty} {it.unit}</Td>
                <Td right>{fmtKES(it.valueCents)}</Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
