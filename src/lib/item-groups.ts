"use server";

import { db, itemGroups, items } from "@/db";
import { eq, and, ne, sql, inArray } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const access = await getAccess();
  if (!access || (!access.isOwner && access.role !== "admin")) {
    throw new Error("Only the owner or an admin can manage item groups");
  }
}

const VALID_APPLIES_TO = ["goods", "service", "both"] as const;
export type ItemGroupAppliesTo = (typeof VALID_APPLIES_TO)[number];

/** True if `candidateId` is `groupId` itself or one of its descendants — same walk-the-tree cycle check as customer groups. */
async function isSelfOrDescendant(orgId: number, groupId: number, candidateId: number): Promise<boolean> {
  if (groupId === candidateId) return true;
  const all = await db.select({ id: itemGroups.id, parentGroupId: itemGroups.parentGroupId }).from(itemGroups).where(eq(itemGroups.orgId, orgId));
  const children = new Map<number, number[]>();
  for (const g of all) {
    if (g.parentGroupId == null) continue;
    const arr = children.get(g.parentGroupId) ?? [];
    arr.push(g.id);
    children.set(g.parentGroupId, arr);
  }
  const stack = [...(children.get(groupId) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (next === candidateId) return true;
    stack.push(...(children.get(next) ?? []));
  }
  return false;
}

async function validateParent(orgId: number, groupId: number | null, parentGroupId: number | null | undefined): Promise<number | null> {
  if (parentGroupId == null) return null;
  const [parent] = await db.select({ id: itemGroups.id }).from(itemGroups).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, parentGroupId))).limit(1);
  if (!parent) throw new Error("The chosen parent group no longer exists");
  if (groupId != null && (await isSelfOrDescendant(orgId, groupId, parentGroupId))) {
    throw new Error("A group can't be moved under itself or one of its own subgroups");
  }
  return parentGroupId;
}

function normalizeAppliesTo(v: string | null | undefined): ItemGroupAppliesTo {
  return (VALID_APPLIES_TO as readonly string[]).includes(v ?? "") ? (v as ItemGroupAppliesTo) : "both";
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

export async function createItemGroupAction(name: string, parentGroupId?: number | null, appliesTo?: string) {
  return withOrg(async () => {
    await requirePerm("items");
    await requireAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: itemGroups.id })
      .from(itemGroups)
      .where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.name, trimmed)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    const parent = await validateParent(orgId, null, parentGroupId);
    const [created] = await db.insert(itemGroups).values({ orgId, name: trimmed, parentGroupId: parent, appliesTo: normalizeAppliesTo(appliesTo), createdAt: nowISO() }).returning();
    await logAudit({ action: "create", module: "items", recordId: created.id, recordLabel: trimmed, detail: parent ? `Subgroup of group #${parent}` : undefined });
    revalidatePath("/items/groups");
    revalidatePath("/items/new");
    revalidatePath("/items");
    return { success: true };
  });
}

export async function renameItemGroupAction(id: number, name: string, parentGroupId?: number | null, appliesTo?: string) {
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
    const parent = parentGroupId === undefined ? undefined : await validateParent(orgId, id, parentGroupId);
    await db
      .update(itemGroups)
      .set({
        name: trimmed,
        ...(parent !== undefined ? { parentGroupId: parent } : {}),
        ...(appliesTo !== undefined ? { appliesTo: normalizeAppliesTo(appliesTo) } : {}),
      })
      .where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, id)));
    await logAudit({ action: "update", module: "items", recordId: id, recordLabel: trimmed });
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
    const [group] = await db.select({ name: itemGroups.name }).from(itemGroups).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, id))).limit(1);
    // Promote direct subgroups to top-level rather than cascading the delete —
    // same "don't strand children" philosophy as customer groups.
    await db.update(itemGroups).set({ parentGroupId: null }).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.parentGroupId, id)));
    await db.delete(itemGroups).where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, id)));
    await logAudit({ action: "delete", module: "items", recordId: id, recordLabel: group?.name });
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
    await logAudit({ action: "update", module: "items", recordId: itemGroupId, recordLabel: `Bulk-assigned ${itemIds.length} item(s)` });
    revalidatePath("/items");
    revalidatePath("/reports/sales/item-groups");
    return { success: true };
  });
}
