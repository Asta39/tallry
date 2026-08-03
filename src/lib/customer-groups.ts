"use server";

import { db, customerGroups, contacts, contactGroupMemberships } from "@/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/** Owner or admin only — group management is an admin concern. */
async function requireAdmin() {
  const access = await getAccess();
  if (!access || (!access.isOwner && access.role !== "admin")) {
    throw new Error("Only the owner or an admin can manage customer groups");
  }
}

/** True if `candidateId` is `groupId` itself or one of its descendants — walks the parent chain upward from every group to find cycles cheaply without a recursive CTE. */
async function isSelfOrDescendant(orgId: number, groupId: number, candidateId: number): Promise<boolean> {
  if (groupId === candidateId) return true;
  const all = await db.select({ id: customerGroups.id, parentGroupId: customerGroups.parentGroupId }).from(customerGroups).where(eq(customerGroups.orgId, orgId));
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
  const [parent] = await db.select({ id: customerGroups.id }).from(customerGroups).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, parentGroupId))).limit(1);
  if (!parent) throw new Error("The chosen parent group no longer exists");
  // Only relevant when reparenting an existing group — a brand-new group has
  // no descendants yet, so it can never be its own ancestor.
  if (groupId != null && (await isSelfOrDescendant(orgId, groupId, parentGroupId))) {
    throw new Error("A group can't be moved under itself or one of its own subgroups");
  }
  return parentGroupId;
}

export async function listCustomerGroups() {
  return withOrg(() =>
    db.select().from(customerGroups).where(eq(customerGroups.orgId, currentOrgId())).orderBy(customerGroups.name)
  );
}

/** Groups with a live count of the customers in each, for the admin screen. Counts are per-group only — a subgroup's members do not roll up into its parent's count. */
export async function listCustomerGroupsWithCounts() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const groups = await db.select().from(customerGroups).where(eq(customerGroups.orgId, orgId)).orderBy(customerGroups.name);
    const counts = await db
      .select({ groupId: contactGroupMemberships.groupId, n: sql<number>`count(*)` })
      .from(contactGroupMemberships)
      .innerJoin(contacts, eq(contactGroupMemberships.contactId, contacts.id))
      .where(and(eq(contactGroupMemberships.orgId, orgId), eq(contacts.archived, false)))
      .groupBy(contactGroupMemberships.groupId);
    const byId = new Map(counts.map((c) => [c.groupId, Number(c.n)]));
    return groups.map((g) => ({ ...g, memberCount: byId.get(g.id) ?? 0 }));
  });
}

/** The groups one contact belongs to. */
export async function getContactGroups(contactId: number) {
  return withOrg(() =>
    db
      .select({ id: customerGroups.id, name: customerGroups.name })
      .from(contactGroupMemberships)
      .innerJoin(customerGroups, eq(contactGroupMemberships.groupId, customerGroups.id))
      .where(and(eq(contactGroupMemberships.orgId, currentOrgId()), eq(contactGroupMemberships.contactId, contactId)))
      .orderBy(customerGroups.name)
  );
}

export async function createCustomerGroupAction(name: string, parentGroupId?: number | null) {
  return withOrg(async () => {
    await requirePerm("contacts");
    await requireAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.name, trimmed)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    const parent = await validateParent(orgId, null, parentGroupId);
    const [created] = await db.insert(customerGroups).values({ orgId, name: trimmed, parentGroupId: parent, createdAt: nowISO() }).returning();
    await logAudit({ action: "create", module: "contacts", recordId: created.id, recordLabel: trimmed, detail: parent ? `Subgroup of group #${parent}` : undefined });
    revalidatePath("/contacts/groups");
    return { success: true };
  });
}

export async function renameCustomerGroupAction(id: number, name: string, parentGroupId?: number | null) {
  return withOrg(async () => {
    await requirePerm("contacts");
    await requireAdmin();
    const orgId = currentOrgId();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.name, trimmed), ne(customerGroups.id, id)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    const parent = parentGroupId === undefined ? undefined : await validateParent(orgId, id, parentGroupId);
    await db
      .update(customerGroups)
      .set({ name: trimmed, ...(parent !== undefined ? { parentGroupId: parent } : {}) })
      .where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, id)));
    await logAudit({ action: "update", module: "contacts", recordId: id, recordLabel: trimmed });
    revalidatePath("/contacts/groups");
    return { success: true };
  });
}

export async function deleteCustomerGroupAction(id: number) {
  return withOrg(async () => {
    await requirePerm("contacts");
    await requireAdmin();
    const orgId = currentOrgId();
    const [group] = await db.select({ name: customerGroups.name }).from(customerGroups).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, id))).limit(1);
    // Detach members and subgroups rather than block — deleting a segment
    // shouldn't strand its customers or its children; direct subgroups are
    // promoted to top-level, and their own subgroups (if any) stay attached
    // to them, so only one level ever moves.
    await db.update(customerGroups).set({ parentGroupId: null }).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.parentGroupId, id)));
    await db.delete(contactGroupMemberships).where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.groupId, id)));
    await db.update(contacts).set({ groupId: null }).where(and(eq(contacts.orgId, orgId), eq(contacts.groupId, id)));
    await db.delete(customerGroups).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, id)));
    await logAudit({ action: "delete", module: "contacts", recordId: id, recordLabel: group?.name });
    revalidatePath("/contacts/groups");
    revalidatePath("/contacts");
    return { success: true };
  });
}
