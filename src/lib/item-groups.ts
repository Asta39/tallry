"use server";

import { db, itemGroups, items } from "@/db";
import { eq, and, ne, sql, inArray } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const access = await getAccess();
  if (!access || (!access.isOwner && access.role !== "admin")) {
    throw new Error("Only the owner or an admin can manage item groups");
  }
}

export async function listItemGroups() {
  return withOrg(() =>
    db.select().from(itemGroups).where(eq(itemGroups.orgId, currentOrgId())).orderBy(itemGroups.name)
  );
}

export async function listItemGroupsWithCounts() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const groups = await db.select().from(itemGroups).where(eq(itemGroups.orgId, orgId)).orderBy(itemGroups.name);
    const counts = await db
      .select({ groupId: items.itemGroupId, n: sql<number>`count(*)` })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.archived, false)))
      .groupBy(items.itemGroupId);
    const byId = new Map(counts.filter((c) => c.groupId !== null).map((c) => [c.groupId as number, Number(c.n)]));
    return groups.map((g) => ({ ...g, itemCount: byId.get(g.id) ?? 0 }));
  });
}

export async function createItemGroupAction(name: string) {
  return withOrg(async () => {
    await requirePerm("items");
    await requireAdmin();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: itemGroups.id })
      .from(itemGroups)
      .where(and(eq(itemGroups.orgId, currentOrgId()), eq(itemGroups.name, trimmed)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    await db.insert(itemGroups).values({ orgId: currentOrgId(), name: trimmed, createdAt: nowISO() });
    revalidatePath("/items/groups");
    revalidatePath("/items/new");
    revalidatePath("/items");
    return { success: true };
  });
}

export async function renameItemGroupAction(id: number, name: string) {
  return withOrg(async () => {
    await requirePerm("items");
    await requireAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: itemGroups.id })
      .from(itemGroups)
      .where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.name, trimmed), ne(itemGroups.id, id)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    await db.update(itemGroups).set({ name: trimmed }).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, id)));
    revalidatePath("/items/groups");
    revalidatePath("/items");
    revalidatePath("/reports/sales/item-groups");
    return { success: true };
  });
}

export async function deleteItemGroupAction(id: number) {
  return withOrg(async () => {
    await requirePerm("items");
    await requireAdmin();
    const orgId = currentOrgId();
    const [usage] = await db
      .select({ n: sql<number>`count(*)` })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.itemGroupId, id), eq(items.archived, false)));
    if (Number(usage?.n ?? 0) > 0) {
      throw new Error("Move items out of this group before deleting it");
    }
    await db.delete(itemGroups).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, id)));
    revalidatePath("/items/groups");
    revalidatePath("/items/new");
    revalidatePath("/reports/sales/item-groups");
    return { success: true };
  });
}

export async function assignItemGroupsAction(itemIds: number[], itemGroupId: number) {
  return withOrg(async () => {
    await requirePerm("items");
    await requireAdmin();
    const orgId = currentOrgId();
    if (!itemIds.length) throw new Error("Select at least one item");
    const [group] = await db
      .select({ id: itemGroups.id })
      .from(itemGroups)
      .where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, itemGroupId)))
      .limit(1);
    if (!group) throw new Error("The chosen item group no longer exists");
    await db
      .update(items)
      .set({ itemGroupId })
      .where(and(eq(items.orgId, orgId), inArray(items.id, itemIds)));
    revalidatePath("/items");
    revalidatePath("/reports/sales/item-groups");
    return { success: true };
  });
}
