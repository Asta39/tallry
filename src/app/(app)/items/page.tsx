import { redirect } from "next/navigation";
import { db, items } from "@/db";
import { eq } from "drizzle-orm";
import { fmtKES, parseKES } from "@/lib/money";
import { stockOnHand, stockValueCents } from "@/lib/inventory";
import { adjustStock } from "@/lib/actions";
import { TAX_CLASSES, type TaxClass } from "@/lib/tax";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const rows = await db.select().from(items).where(eq(items.archived, false));
  const stock = new Map<number, { qty: number; value: number }>();
  await Promise.all(
    rows
      .filter((it) => it.trackInventory)
      .map(async (it) => {
        stock.set(it.id, { qty: await stockOnHand(it.id), value: await stockValueCents(it.id) });
      })
  );

  async function adjust(formData: FormData) {
    "use server";
    const itemId = Number(formData.get("itemId"));
    const qty = Number(formData.get("qty"));
    const cost = parseKES(String(formData.get("cost") || "0")) || 0;
    if (itemId && qty) await adjustStock(itemId, qty, cost, String(formData.get("reason") || "manual"));
    redirect("/items");
  }

  return (
    <>
      <PageHeader
        title="Items & Stock"
        subtitle="Products and services · stock valued at FIFO cost"
        action={<PrimaryLink href="/items/new">+ New item</PrimaryLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No items yet"
          body="Add the products you sell or services you offer. Tracked goods get FIFO stock control with reorder alerts."
          action={<PrimaryLink href="/items/new">+ New item</PrimaryLink>}
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
                    {it.trackInventory && (
                      <form action={adjust} className="flex gap-1 items-center">
                        <input type="hidden" name="itemId" value={it.id} />
                        <input name="qty" placeholder="±qty" className="w-14 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[12px]" />
                        <input name="cost" placeholder="cost" className="w-16 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[12px]" />
                        <input type="hidden" name="reason" value="manual adjustment" />
                        <button className="text-[12px] text-[var(--color-accent-600)] font-medium px-1">OK</button>
                      </form>
                    )}
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
