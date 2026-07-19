import { db, superAdmins } from "@/db";
import { eq } from "drizzle-orm";
import { getUser } from "@/lib/supabase/server";

/**
 * Super admin check — single source of truth.
 * An email qualifies if it's in the SUPER_ADMIN_EMAILS env var (bootstrap,
 * so the first admin can never be locked out) OR in the super_admins table
 * (managed from the /admin panel).
 */
export async function isSuperAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const envAdmins = (process.env.SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (envAdmins.includes(normalized)) return true;
  const [row] = await db.select({ id: superAdmins.id }).from(superAdmins).where(eq(superAdmins.email, normalized)).limit(1);
  return !!row;
}

/** Throws unless the current session belongs to a super admin. Returns the user. */
export async function requireSuperAdmin() {
  const user = await getUser();
  if (!user || !user.email || !(await isSuperAdmin(user.email))) {
    throw new Error("Unauthorized");
  }
  return user;
}
