"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, superAdmins, subscriptions, org } from "@/db";
import { eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";
import { logAdminAction } from "@/lib/admin-audit";
import { PLANS, PlanKey } from "@/lib/billing";

export async function stopImpersonating() {
  const user = await requireSuperAdmin();

  const cookieStore = await cookies();
  const orgId = cookieStore.get("impersonated_org_id")?.value;
  cookieStore.delete("impersonated_org_id");
  await logAdminAction({ actorEmail: user.email!, action: "impersonate_stop", targetType: "org", targetId: orgId });
  redirect("/admin");
}

export async function impersonateOrg(orgId: number) {
  const user = await requireSuperAdmin();

  const cookieStore = await cookies();
  // Auto-expires after 1 hour so an impersonation session can't linger forever
  cookieStore.set("impersonated_org_id", String(orgId), { path: "/", maxAge: 60 * 60 });
  await logAdminAction({ actorEmail: user.email!, action: "impersonate_start", targetType: "org", targetId: orgId });

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
  await logAdminAction({ actorEmail: user.email!, action: "super_admin_add", targetType: "super_admin", targetId: email });
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
  await logAdminAction({ actorEmail: user.email!, action: "super_admin_remove", targetType: "super_admin", targetId: row.email });
  revalidatePath("/admin/team");
  return { success: true };
}

/** Set an org's plan and paid-until date (comp/support tool — bypasses payment). */
export async function setOrgPlanAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();

  const plan = String(formData.get("plan") || "") as PlanKey;
  const paidUntil = String(formData.get("paidUntil") || "");
  if (!(plan in PLANS)) return { error: "Invalid plan" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidUntil)) return { error: "Pick a valid paid-until date" };

  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };

  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  const before = existing ? `${existing.plan} until ${existing.paidUntil}` : "none";
  if (existing) {
    await db.update(subscriptions).set({ plan, paidUntil, status: "active" }).where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({ orgId, plan, paidUntil, status: "active", createdAt: new Date().toISOString() });
  }

  await logAdminAction({
    actorEmail: user.email!,
    action: "plan_change",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: ${before} → ${plan} until ${paidUntil}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/revenue");
  return { success: true };
}
