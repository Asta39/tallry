import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, items } from "@/db";
import { eq, and } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { stockOnHand, stockValueCents } from "@/lib/inventory";
import { TAX_CLASSES, type TaxClass } from "@/lib/tax";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";
import { CsvImporter } from "@/components/CsvImporter";
import { StockAdjust } from "@/components/StockAdjust";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  await requirePerm("items");
  const o = await getOrg();
  const rows = await db.select().from(items).where(and(eq(items.orgId, o.id), eq(items.archived, false)));
  const stock = new Map<number, { qty: number; value: number }>();
  await Promise.all(
    rows
      .filter((it) => it.trackInventory)
      .map(async (it) => {
        stock.set(it.id, { qty: await withOrg(() => stockOnHand(it.id)), value: await withOrg(() => stockValueCents(it.id)) });
      })
  );

  return (
    <>
      <PageHeader
        title="Items & Stock"
        subtitle="Products and services · stock valued at FIFO cost"
        action={
          <div className="flex items-start gap-2">
            <CsvImporter entity="items" label="Bulk import items" />
            <PrimaryLink href="/items/new">+ New item</PrimaryLink>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No items yet"
          body="Add the products you sell or services you offer. Tracked goods get FIFO stock control with reorder alerts."
          action={
          <div className="flex items-start gap-2">
            <CsvImporter entity="items" label="Bulk import items" />
            <PrimaryLink href="/items/new">+ New item</PrimaryLink>
          </div>
        }
        />
      ) : (
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
            {rows.map((it) => {
              const qty = it.trackInventory ? stock.get(it.id)?.qty ?? 0 : null;
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
                  <Td right>{it.trackInventory ? fmtKES(stock.get(it.id)?.value ?? 0) : "—"}</Td>
                  <Td>
                    {it.trackInventory && <StockAdjust itemId={it.id} unit={it.unit} />}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
