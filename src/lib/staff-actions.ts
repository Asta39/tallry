"use server";

import { db, members, rolePermissions, todos, events } from "@/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAccess, ROLES, type Role } from "./access";
import { createAdminClient } from "./supabase/admin";
import { nowISO } from "./money";

async function requireAdmin() {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  if (access.role !== "admin") throw new Error("Only admins can manage staff");
  return access;
}

/** Create a staff account: Supabase auth user (email confirmed) + member row. */
export async function createStaff(data: {
  name: string;
  email: string;
  password: string;
  role: string;
}) {
  const access = await requireAdmin();
  const role = (ROLES.includes(data.role as Role) ? data.role : "staff") as Role;
  if (data.password.length < 8) throw new Error("Password must be at least 8 characters");

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: { name: data.name, invited_by_org: access.orgId },
  });
  if (error) throw new Error(`Could not create account: ${error.message}`);

  await db.insert(members).values({
    orgId: access.orgId,
    userId: created.user.id,
    email: data.email.trim().toLowerCase(),
    name: data.name.trim(),
    role,
    createdAt: nowISO(),
  });
  revalidatePath("/staff");
}

export async function updateStaff(memberId: number, patch: { role?: string; active?: boolean; name?: string }) {
  const access = await requireAdmin();
  await db
    .update(members)
    .set({
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
    })
    .where(and(eq(members.orgId, access.orgId), eq(members.id, memberId)));
  revalidatePath("/staff");
}

/** Toggle a module on/off for a role. */
export async function setRolePermission(role: string, permKey: string, allowed: boolean) {
  const access = await requireAdmin();
  if (role === "admin") throw new Error("Admin role always has full access");
  const existing = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.orgId, access.orgId),
        eq(rolePermissions.role, role),
        eq(rolePermissions.permKey, permKey)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db.update(rolePermissions).set({ allowed }).where(eq(rolePermissions.id, existing[0].id));
  } else {
    await db.insert(rolePermissions).values({ orgId: access.orgId, role, permKey, allowed });
  }
  revalidatePath("/staff");
}

/* ---------------- Dashboard: todos & events ---------------- */

export async function addTodo(title: string, dueDate?: string) {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  if (!title.trim()) return;
  await db.insert(todos).values({ orgId: access.orgId, title: title.trim(), dueDate: dueDate || null, createdAt: nowISO() });
  revalidatePath("/");
}

export async function toggleTodo(id: number, done: boolean) {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  await db.update(todos).set({ done }).where(and(eq(todos.orgId, access.orgId), eq(todos.id, id)));
  revalidatePath("/");
}

export async function deleteTodo(id: number) {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  await db.delete(todos).where(and(eq(todos.orgId, access.orgId), eq(todos.id, id)));
  revalidatePath("/");
}

export async function addEvent(title: string, date: string, color?: string) {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  if (!title.trim() || !date) return;
  await db.insert(events).values({
    orgId: access.orgId,
    title: title.trim(),
    date,
    color: color || access.orgRow.brandColor || "#0f766e",
    createdAt: nowISO(),
  });
  revalidatePath("/");
}

export async function deleteEvent(id: number) {
  const access = await getAccess();
  if (!access) throw new Error("Not signed in");
  await db.delete(events).where(and(eq(events.orgId, access.orgId), eq(events.id, id)));
  revalidatePath("/");
}
