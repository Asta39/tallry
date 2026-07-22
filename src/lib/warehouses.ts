"use server";

import { db, warehouses, stockLots } from "@/db";
import { eq, and, ne } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { nowISO, todayISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { transferStock, stockByWarehouse, itemsInWarehouse } from "@/lib/inventory";

export async function listWarehouses() {
  return withOrg(() => db.select().from(warehouses).where(eq(warehouses.orgId, currentOrgId())).orderBy(warehouses.name));
}

export async function createWarehouseAction(name: string) {
  return withOrg(async () => {
    await requirePerm("items");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");
    await db.insert(warehouses).values({ orgId: currentOrgId(), name: trimmed, createdAt: nowISO() });
    revalidatePath("/items/warehouses");
    return { success: true };
  });
}

export async function renameWarehouseAction(id: number, name: string) {
  return withOrg(async () => {
    await requirePerm("items");
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");
    const [w] = await db.select().from(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id))).limit(1);
    if (!w) throw new Error("Warehouse not found");
    await db.update(warehouses).set({ name: trimmed }).where(eq(warehouses.id, id));
    revalidatePath("/items/warehouses");
    return { success: true };
  });
}

export async function setDefaultWarehouseAction(id: number) {
  return withOrg(async () => {
    await requirePerm("items");
    const orgId = currentOrgId();
    const [w] = await db.select().from(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id))).limit(1);
    if (!w) throw new Error("Warehouse not found");
    if (w.archived) throw new Error("Can't set an archived warehouse as default");
    await db.update(warehouses).set({ isDefault: false }).where(and(eq(warehouses.orgId, orgId), ne(warehouses.id, id)));
    await db.update(warehouses).set({ isDefault: true }).where(eq(warehouses.id, id));
    revalidatePath("/items/warehouses");
    return { success: true };
  });
}

export async function archiveWarehouseAction(id: number, archived: boolean) {
  return withOrg(async () => {
    await requirePerm("items");
    const orgId = currentOrgId();
    const [w] = await db.select().from(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id))).limit(1);
    if (!w) throw new Error("Warehouse not found");
    if (w.isDefault) throw new Error("Can't archive the default warehouse — set another one as default first");
    await db.update(warehouses).set({ archived }).where(eq(warehouses.id, id));
    revalidatePath("/items/warehouses");
    return { success: true };
  });
}

export async function transferStockAction(data: {
  itemId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  qty: number;
  date?: string;
  note?: string;
}) {
  return withOrg(async () => {
    await requirePerm("items");
    const result = await transferStock({
      itemId: data.itemId,
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      qty: data.qty,
      date: data.date || todayISO(),
      note: data.note,
    });
    revalidatePath("/items");
    revalidatePath("/items/transfers");
    return result;
  });
}

export async function getItemStockByWarehouse(itemId: number) {
  return withOrg(() => stockByWarehouse(itemId));
}

export async function getWarehouseDetail(id: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const [w] = await db.select().from(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.id, id))).limit(1);
    if (!w) return null;
    const stockItems = await itemsInWarehouse(id);
    const totalValueCents = stockItems.reduce((sum, i) => sum + i.valueCents, 0);
    return { warehouse: w, items: stockItems, totalValueCents };
  });
}
