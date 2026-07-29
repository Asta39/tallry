"use server";

import { db, customerGroups, contacts, contactGroupMemberships } from "@/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

/** Owner or admin only — group management is an admin concern. */
async function requireAdmin() {
  const access = await getAccess();
  if (!access || (!access.isOwner && access.role !== "admin")) {
    throw new Error("Only the owner or an admin can manage customer groups");
  }
}

export async function listCustomerGroups() {
  return withOrg(() =>
    db.select().from(customerGroups).where(eq(customerGroups.orgId, currentOrgId())).orderBy(customerGroups.name)
  );
}

/** Groups with a live count of the customers in each, for the admin screen. */
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

export async function createCustomerGroupAction(name: string) {
  return withOrg(async () => {
    await requirePerm("contacts");
    await requireAdmin();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Group name is required");
    const [dupe] = await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(and(eq(customerGroups.orgId, currentOrgId()), eq(customerGroups.name, trimmed)))
      .limit(1);
    if (dupe) throw new Error(`A group called "${trimmed}" already exists`);
    await db.insert(customerGroups).values({ orgId: currentOrgId(), name: trimmed, createdAt: nowISO() });
    revalidatePath("/contacts/groups");
    return { success: true };
  });
}

export async function renameCustomerGroupAction(id: number, name: string) {
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
    await db.update(customerGroups).set({ name: trimmed }).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, id)));
    revalidatePath("/contacts/groups");
    return { success: true };
  });
}

export async function deleteCustomerGroupAction(id: number) {
  return withOrg(async () => {
    await requirePerm("contacts");
    await requireAdmin();
    const orgId = currentOrgId();
    // Detach members rather than block — deleting a segment shouldn't strand
    // its customers; they simply lose this membership.
    await db.delete(contactGroupMemberships).where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.groupId, id)));
    await db.update(contacts).set({ groupId: null }).where(and(eq(contacts.orgId, orgId), eq(contacts.groupId, id)));
    await db.delete(customerGroups).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, id)));
    revalidatePath("/contacts/groups");
    revalidatePath("/contacts");
    return { success: true };
  });
}
