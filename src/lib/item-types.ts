"use server";

import { db, itemTypes, items } from "@/db";
import { eq, and, asc, ne } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

/** Only the org owner or an admin-role member manages the item taxonomy —
 *  matches the request's "admin can create other types" scoping. */
async function assertIsAdmin() {
  const access = await getAccess();
  if (!access || !(access.isOwner || access.role === "admin")) {
    throw new Error("Only an admin can manage item types");
  }
  return access;
}

export async function listItemTypes() {
  return withOrg(() =>
    db.select().from(itemTypes).where(eq(itemTypes.orgId, currentOrgId())).orderBy(asc(itemTypes.id))
  );
}

export async function createItemTypeAction(name: string, isGroupMandatory: boolean) {
  return withOrg(async () => {
    await assertIsAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    const [dupe] = await db
      .select({ id: itemTypes.id })
      .from(itemTypes)
      .where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.name, trimmed)))
      .limit(1);
    if (dupe) throw new Error(`An item type called "${trimmed}" already exists`);

    const [row] = await db
      .insert(itemTypes)
      .values({ orgId, name: trimmed, isGroupMandatory, isSystem: false, createdAt: nowISO() })
      .returning();

    await logAudit({ action: "create", module: "items", recordId: row.id, recordLabel: trimmed, detail: isGroupMandatory ? "Group mandatory" : "Group optional" });
    revalidatePath("/items/types");
    revalidatePath("/items/new");
    return { success: true };
  });
}

export async function updateItemTypeAction(id: number, name: string, isGroupMandatory: boolean) {
  return withOrg(async () => {
    await assertIsAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Name is required");

    const [existing] = await db.select().from(itemTypes).where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.id, id))).limit(1);
    if (!existing) throw new Error("Item type not found");
    if (existing.isSystem) throw new Error("System item types can't be renamed, but you can still change whether a group is required");

    const [dupe] = await db
      .select({ id: itemTypes.id })
      .from(itemTypes)
      .where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.name, trimmed), ne(itemTypes.id, id)))
      .limit(1);
    if (dupe) throw new Error(`An item type called "${trimmed}" already exists`);

    // A rename must cascade to every item already using the old name, or
    // those items silently fall back to "no known type" (items.kind is a
    // plain string, not a foreign key — see schema.ts for why).
    if (trimmed !== existing.name) {
      await db.update(items).set({ kind: trimmed }).where(and(eq(items.orgId, orgId), eq(items.kind, existing.name)));
    }

    await db.update(itemTypes).set({ name: trimmed, isGroupMandatory }).where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.id, id)));

    await logAudit({ action: "update", module: "items", recordId: id, recordLabel: trimmed, detail: isGroupMandatory ? "Group mandatory" : "Group optional" });
    revalidatePath("/items/types");
    revalidatePath("/items/new");
    return { success: true };
  });
}

export async function deleteItemTypeAction(id: number) {
  return withOrg(async () => {
    await assertIsAdmin();
    const orgId = currentOrgId();

    const [existing] = await db.select().from(itemTypes).where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.id, id))).limit(1);
    if (!existing) throw new Error("Item type not found");
    if (existing.isSystem) throw new Error("System item types can't be deleted");

    const [inUse] = await db.select({ id: items.id }).from(items).where(and(eq(items.orgId, orgId), eq(items.kind, existing.name))).limit(1);
    if (inUse) throw new Error(`"${existing.name}" is still used by existing items — reassign them first`);

    await db.delete(itemTypes).where(and(eq(itemTypes.orgId, orgId), eq(itemTypes.id, id)));

    await logAudit({ action: "delete", module: "items", recordId: id, recordLabel: existing.name });
    revalidatePath("/items/types");
    revalidatePath("/items/new");
    return { success: true };
  });
}
