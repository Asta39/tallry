import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, items } from "@/db";
import { eq, and } from "drizzle-orm";
import { stockOnHand, stockValueCents } from "@/lib/inventory";
import { PageHeader, PrimaryLink, EmptyState } from "@/components/ui";
import { CsvImporter } from "@/components/CsvImporter";
import { ItemsTable } from "@/components/ItemsTable";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  await requirePerm("items");
  const o = await getOrg();
  const rows = await db.select().from(items).where(and(eq(items.orgId, o.id), eq(items.archived, false)));
  const stock: Record<number, { qty: number; value: number }> = {};
  await Promise.all(
    rows
      .filter((it) => it.trackInventory)
      .map(async (it) => {
        stock[it.id] = { qty: await withOrg(() => stockOnHand(it.id)), value: await withOrg(() => stockValueCents(it.id)) };
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
        <ItemsTable rows={rows} stock={stock} />
      )}
    </>
  );
}
