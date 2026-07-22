import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, items, stockTransfers, warehouses } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { TransferForm } from "./TransferForm";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  await requirePerm("items");
  const o = await getOrg();

  const [trackedItems, activeWarehouses, recentTransfers] = await Promise.all([
    db.select().from(items).where(and(eq(items.orgId, o.id), eq(items.trackInventory, true), eq(items.archived, false))),
    db.select().from(warehouses).where(and(eq(warehouses.orgId, o.id), eq(warehouses.archived, false))),
    db.select().from(stockTransfers).where(eq(stockTransfers.orgId, o.id)).orderBy(desc(stockTransfers.id)).limit(30),
  ]);

  const itemName = new Map(trackedItems.map((i) => [i.id, i.name]));
  const warehouseName = new Map(activeWarehouses.map((w) => [w.id, w.name]));

  return (
    <>
      <PageHeader title="Stock Transfers" subtitle="Move inventory between warehouses at cost — no ledger impact." />

      {activeWarehouses.length < 2 ? (
        <div className="card p-8 text-center text-[var(--color-ink-400)]">
          Add a second warehouse first — transfers need at least two locations.
        </div>
      ) : (
        <TransferForm
          items={trackedItems.map((i) => ({ id: i.id, name: i.name }))}
          warehouses={activeWarehouses.map((w) => ({ id: w.id, name: w.name }))}
        />
      )}

      <div className="card overflow-hidden mt-6">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Item</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">From → To</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Qty</th>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Unit cost</th>
            </tr>
          </thead>
          <tbody>
            {recentTransfers.map((t) => (
              <tr key={t.id} className="hairline-t">
                <td className="px-4 py-2.5 text-[13px] tnum text-[var(--color-ink-400)]">{t.date}</td>
                <td className="px-3 py-2.5 text-[13px] font-medium">{itemName.get(t.itemId) || `Item #${t.itemId}`}</td>
                <td className="px-3 py-2.5 text-[13px]">{warehouseName.get(t.fromWarehouseId) || "—"} → {warehouseName.get(t.toWarehouseId) || "—"}</td>
                <td className="px-3 py-2.5 text-[13px] text-right tnum">{t.qty}</td>
                <td className="px-4 py-2.5 text-[13px] text-right tnum">{fmtKES(t.unitCostCents)}</td>
              </tr>
            ))}
            {recentTransfers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No transfers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
