"use server";

import { db, itemBoms, items } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

export async function listItemBom(parentItemId: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    return db
      .select({
        id: itemBoms.id,
        componentItemId: itemBoms.componentItemId,
        componentName: items.name,
        qtyPerUnit: itemBoms.qtyPerUnit,
        wasteQtyPerUnit: itemBoms.wasteQtyPerUnit,
      })
      .from(itemBoms)
      .innerJoin(items, eq(items.id, itemBoms.componentItemId))
      .where(and(eq(itemBoms.orgId, orgId), eq(itemBoms.parentItemId, parentItemId)));
  });
}

/** Tracked-inventory items eligible to be a BOM component — excludes the
 *  parent itself (no self-referencing kits) and anything not stock-tracked
 *  (a component with no FIFO stock of its own can't be consumed). */
export async function listBomComponentOptions(parentItemId: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    return db
      .select({ id: items.id, name: items.name, unit: items.unit, measurementType: items.measurementType })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.trackInventory, true), eq(items.archived, false), ne(items.id, parentItemId)))
      .orderBy(items.name);
  });
}

/** Replaces a parent item's entire BOM with the given rows — simplest
 *  correct semantics for a small "list of components" editor (no per-row
 *  add/remove server calls to keep in sync with client state). */
export async function setItemBomAction(
  parentItemId: number,
  rows: { componentItemId: number; qtyPerUnit: number; wasteQtyPerUnit: number }[]
): Promise<{ success?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("items");
      const orgId = currentOrgId();

      const [parent] = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.id, parentItemId))).limit(1);
      if (!parent) throw new Error("Item not found");

      for (const r of rows) {
        if (r.componentItemId === parentItemId) throw new Error("A product can't be a component of itself");
        if (r.qtyPerUnit <= 0) throw new Error("Each component needs a quantity greater than 0");
        if (r.wasteQtyPerUnit < 0) throw new Error("Waste quantity can't be negative");
      }
      const dupes = new Set(rows.map((r) => r.componentItemId));
      if (dupes.size !== rows.length) throw new Error("Each component can only appear once");

      await db.delete(itemBoms).where(and(eq(itemBoms.orgId, orgId), eq(itemBoms.parentItemId, parentItemId)));
      if (rows.length > 0) {
        await db.insert(itemBoms).values(
          rows.map((r) => ({
            orgId,
            parentItemId,
            componentItemId: r.componentItemId,
            qtyPerUnit: r.qtyPerUnit,
            wasteQtyPerUnit: r.wasteQtyPerUnit,
            createdAt: nowISO(),
          }))
        );
      }

      revalidatePath(`/items/${parentItemId}/edit`);
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Could not save Bill of Materials" };
  }
}
