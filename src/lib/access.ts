import { cache } from "react";
import { db, org, members, rolePermissions, customRoles } from "@/db";
import { and, eq } from "drizzle-orm";
import { getUser } from "./supabase/server";

/**
 * Roles & module permissions.
 * The org owner (org.userId) is always an admin and cannot be locked out.
 * Staff get a role; the admin can toggle which modules each role sees —
 * toggles live in role_permissions and override the defaults below.
 */

export const ROLES = ["admin", "accountant", "sales", "hr", "inventory", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const MODULES: { key: string; label: string }[] = [
  { key: "dashboard", label: "Home dashboard" },
  { key: "dashboard_metrics", label: "Own metrics only (dashboard shows just their documents)" },
  { key: "contacts", label: "Customers & Vendors" },
  { key: "pipeline", label: "Deals pipeline" },
  { key: "quotes", label: "Quotes" },
  { key: "invoices", label: "Invoices" },
  { key: "credit_notes", label: "Credit notes" },
  { key: "expenses", label: "Expenses" },
  { key: "bills", label: "Bills" },
  { key: "purchase_orders", label: "Purchase orders" },
  { key: "items", label: "Items & Stock" },
  { key: "banking", label: "Bank & M-Pesa" },
  { key: "payroll", label: "Payroll" },
  { key: "fixed_assets", label: "Fixed Assets" },
  { key: "vat3", label: "iTax VAT3" },
  { key: "accountant", label: "Accountant (ledger)" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
  { key: "staff", label: "Staff & roles" },
  { key: "can_payout", label: "Gateway Payouts" },
];

const ALL = MODULES.map((m) => m.key);

export const DEFAULT_ROLE_PERMS: Record<Role, string[]> = {
  admin: ALL,
  accountant: ALL.filter((k) => !["staff", "settings", "can_payout"].includes(k)),
  sales: ["dashboard", "dashboard_metrics", "contacts", "pipeline", "quotes", "invoices", "credit_notes", "items"],
  hr: ["dashboard", "dashboard_metrics", "contacts", "reports", "payroll"],
  inventory: ["dashboard", "dashboard_metrics", "items", "purchase_orders", "bills", "contacts"],
  staff: ["dashboard", "dashboard_metrics"],
};

export interface Access {
  orgId: number;
  orgRow: typeof org.$inferSelect;
  userId: string;
  isOwner: boolean;
  role: string;
  memberName: string;
  memberId: number | null;
  perms: Set<string>;
}

/** Resolve the signed-in user's org, role and effective permissions. */
export async function getAccess(): Promise<Access | null> {
  const user = await getUser();
  if (!user) return null;

  // Owner path
  const [owned] = await db.select().from(org).where(eq(org.userId, user.id)).limit(1);
  if (owned) {
    return {
      orgId: owned.id,
      orgRow: owned,
      userId: user.id,
      isOwner: true,
      role: "admin",
      memberName: owned.name,
      memberId: null, // owner might not have a member record unless created
      perms: new Set(ALL),
    };
  }

  // Staff path
  const [m] = await db
    .select()
    .from(members)
    .where(and(eq(members.userId, user.id), eq(members.active, true)))
    .limit(1);
  if (!m) return null;
  const [o] = await db.select().from(org).where(eq(org.id, m.orgId)).limit(1);
  if (!o) return null;

  const role = m.role;
  const defaultPerms = DEFAULT_ROLE_PERMS[role as Role] || [];
  const perms = new Set(defaultPerms);
  if (role !== "admin") {
    const overrides = await db
      .select()
      .from(rolePermissions)
      .where(and(eq(rolePermissions.orgId, m.orgId), eq(rolePermissions.role, role)));
    for (const ov of overrides) {
      if (ov.allowed) perms.add(ov.permKey);
      else perms.delete(ov.permKey);
    }
    perms.add("dashboard"); // never lock anyone out of home
  }

  return {
    orgId: m.orgId,
    orgRow: o,
    userId: user.id,
    isOwner: false,
    role,
    memberName: m.name || m.email,
    memberId: m.id,
    perms: role === "admin" ? new Set(ALL) : perms,
  };
}

/** Effective permission map for a role (defaults + org overrides). */
export async function rolePermMap(orgId: number, role: string): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};
  const defaultPerms = DEFAULT_ROLE_PERMS[role as Role] || [];
  for (const m of MODULES) map[m.key] = defaultPerms.includes(m.key);
  const overrides = await db
    .select()
    .from(rolePermissions)
    .where(and(eq(rolePermissions.orgId, orgId), eq(rolePermissions.role, role)));
  for (const ov of overrides) map[ov.permKey] = ov.allowed;
  return map;
}

/**
 * Per-request memoized access check.
 * The layout and any server component calling this in the same render
 * share a single set of DB queries instead of each hitting the DB.
 */
export const getAccessCached = cache(getAccess);

export function canViewAllData(access: Access): boolean {
  if (access.isOwner || access.role === "admin") return true;
  if (!access.orgRow.dataSegregation) return true;
  return false;
}

/** Get all system and custom roles for an organization. */
export async function getAllRoles(orgId: number): Promise<string[]> {
  const custom = await db.select().from(customRoles).where(eq(customRoles.orgId, orgId));
  const uniqueCustom = Array.from(new Set(custom.map((c) => c.name)));
  return [...ROLES, ...uniqueCustom];
}
