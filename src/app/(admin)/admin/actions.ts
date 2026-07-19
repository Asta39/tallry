"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, superAdmins } from "@/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";

export async function stopImpersonating() {
  await requireSuperAdmin();

  const cookieStore = await cookies();
  cookieStore.delete("impersonated_org_id");
  redirect("/admin");
}

export async function impersonateOrg(orgId: number) {
  await requireSuperAdmin();

  const cookieStore = await cookies();
  cookieStore.set("impersonated_org_id", String(orgId), { path: "/" });

  redirect("/");
}

export async function addSuperAdminAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address" };
  }

  const [existing] = await db.select({ id: superAdmins.id }).from(superAdmins).where(eq(superAdmins.email, email)).limit(1);
  if (existing) return { error: "Already a super admin" };

  await db.insert(superAdmins).values({
    email,
    addedBy: user.email,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/admin/team");
  return { success: true };
}

export async function removeSuperAdminAction(id: number) {
  const user = await requireSuperAdmin();

  const [row] = await db.select().from(superAdmins).where(eq(superAdmins.id, id)).limit(1);
  if (!row) return { error: "Not found" };
  // Can't remove yourself — prevents locking out the session that's doing the removing
  if (user.email && row.email === user.email.toLowerCase()) {
    return { error: "You can't remove yourself" };
  }

  await db.delete(superAdmins).where(eq(superAdmins.id, id));
  revalidatePath("/admin/team");
  return { success: true };
}
