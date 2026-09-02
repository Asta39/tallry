"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, superAdmins, subscriptions, billingPayments, org, announcements, members } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";
import { logAdminAction } from "@/lib/admin-audit";
import { endOfMonthISO, nextMonthEndISO, PER_STAFF_MONTHLY_FEE_CENTS } from "@/lib/billing";
import { runAndStoreAllOrgChecks } from "@/lib/ledger-integrity";
import { runOrgBackup, runAllOrgBackups, getBackupDownloadUrl } from "@/lib/org-backup";
import { reconcileUnconfirmedKopoKopoPayouts } from "@/lib/payments/webhook";
import { ensurePlatformContactAndTemplate, syncPlatformInvoiceAmount, setPlatformTemplateActive } from "@/lib/platform-invoicing";

export async function reconcilePayoutsNow() {
  const user = await requireSuperAdmin();
  const result = await reconcileUnconfirmedKopoKopoPayouts();
  await logAdminAction({ actorEmail: user.email!, action: "reconcile_payouts_run_now", detail: `${result.checked} checked, ${result.confirmed} confirmed, ${result.reversed} reversed` });
  revalidatePath("/admin/cron");
  return result;
}

export async function runLedgerIntegrityNow() {
  const user = await requireSuperAdmin();
  const result = await runAndStoreAllOrgChecks();
  await logAdminAction({ actorEmail: user.email!, action: "ledger_integrity_run_now", detail: `${result.totalFindings} finding(s) across ${result.orgsChecked} org(s)` });
  revalidatePath("/admin/ledger-integrity");
  return result;
}

export async function runOrgBackupNow(orgId: number) {
  const user = await requireSuperAdmin();
  const result = await runOrgBackup(orgId);
  await logAdminAction({ actorEmail: user.email!, action: "org_backup_run_now", targetType: "org", targetId: orgId, detail: `${result.rowTotal} row(s), ${result.bytes} bytes` });
  revalidatePath("/admin/backups");
  return result;
}

export async function downloadOrgBackupAction(path: string) {
  await requireSuperAdmin();
  return getBackupDownloadUrl(path);
}

export async function runAllOrgBackupsNow() {
  const user = await requireSuperAdmin();
  const result = await runAllOrgBackups();
  await logAdminAction({ actorEmail: user.email!, action: "org_backup_run_all_now", detail: `${result.orgsBackedUp} backed up, ${result.failures.length} failed` });
  revalidatePath("/admin/backups");
  return result;
}

export async function stopImpersonating() {
  const user = await requireSuperAdmin();

  const cookieStore = await cookies();
  const orgId = cookieStore.get("impersonated_org_id")?.value;
  cookieStore.delete("impersonated_org_id");
  await logAdminAction({ actorEmail: user.email!, action: "impersonate_stop", targetType: "org", targetId: orgId });
  return { success: true };
}

export async function impersonateOrg(orgId: number) {
  const user = await requireSuperAdmin();

  const cookieStore = await cookies();
  // Auto-expires after 1 hour so an impersonation session can't linger forever
  cookieStore.set("impersonated_org_id", String(orgId), { path: "/", maxAge: 60 * 60 });
  await logAdminAction({ actorEmail: user.email!, action: "impersonate_start", targetType: "org", targetId: orgId });

  return { success: true };
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

/** Set an org's admin-editable monthly maintenance fee. */
export async function setOrgMonthlyFeeAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();

  const amountCents = Math.round(Number(formData.get("monthlyFee")) * 100);
  if (!Number.isFinite(amountCents) || amountCents < 0) return { error: "Enter a valid amount" };

  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };

  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!existing) return { error: "No subscription record for this org" };
  const today = new Date().toISOString().slice(0, 10);
  await db.update(subscriptions).set({
    monthlyFeeCents: amountCents,
    // First time a fee is set, start the billing cycle at the end of the
    // current calendar month — never leave it empty, and never on a random
    // day-of-month like "next month same day".
    nextMaintenanceDueAt: existing.nextMaintenanceDueAt ?? endOfMonthISO(today),
  }).where(eq(subscriptions.id, existing.id));

  // Keep the operator's own auto-generated maintenance invoice for this
  // client in step with the fee that was just changed — only for orgs
  // already active; a trial org's fee is meaningless to invoice against.
  if (existing.billingStatus === "active") {
    await syncPlatformInvoiceAmount(orgId);
  }

  await logAdminAction({
    actorEmail: user.email!,
    action: "set_monthly_fee",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: monthly fee set to KSh ${(amountCents / 100).toLocaleString("en-KE")}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  return { success: true };
}

/**
 * Activate an org after its trial ends: records the one-time setup fee
 * received (outside the app, as part of the sales deal) and flips billing
 * status to active with the first maintenance cycle starting today.
 */
export async function activateOrgAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();

  const amountCents = Math.round(Number(formData.get("setupFeeAmount")) * 100);
  const date = String(formData.get("setupFeeDate") || "");
  const note = String(formData.get("setupFeeNote") || "").trim() || null;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return { error: "Enter the amount received" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date" };

  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!existing) return { error: "No subscription record for this org" };

  // Maintenance is billed per active staff member — the form pre-fills this
  // from the org's current staff count (KSh 1,000/staff), but the admin can
  // type a different number; fall back to computing it here if the field
  // was left blank.
  const submittedFee = Math.round(Number(formData.get("monthlyFee")) * 100);
  let monthlyFeeCents = Number.isFinite(submittedFee) && submittedFee >= 0 ? submittedFee : NaN;
  if (!Number.isFinite(monthlyFeeCents)) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(members).where(and(eq(members.orgId, orgId), eq(members.active, true)));
    // +1 for the owner — see the matching note in orgs/[id]/page.tsx.
    monthlyFeeCents = (count + 1) * PER_STAFF_MONTHLY_FEE_CENTS;
  }

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(billingPayments).values({
    orgId,
    kind: "setup_fee",
    amountCents,
    method: "mpesa",
    state: "applied",
    note,
    createdAt: date,
    updatedAt: new Date().toISOString(),
  });
  await db.update(subscriptions).set({
    billingStatus: "active",
    activatedAt: today,
    monthlyFeeCents,
    nextMaintenanceDueAt: existing.nextMaintenanceDueAt ?? endOfMonthISO(today),
  }).where(eq(subscriptions.id, existing.id));

  // Creates the operator's own auto-generated maintenance invoice for this
  // client, the first time an org activates out of trial.
  await ensurePlatformContactAndTemplate(orgId);
  await syncPlatformInvoiceAmount(orgId);

  await logAdminAction({
    actorEmail: user.email!,
    action: "activate_org",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: activated, setup fee KSh ${(amountCents / 100).toLocaleString("en-KE")} received ${date}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/billing-payments");
  return { success: true };
}

/** Record a maintenance-fee payment the org made outside the app (bank transfer, cash, etc). */
export async function recordMaintenancePaymentAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();

  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  const date = String(formData.get("date") || "");
  const method = String(formData.get("method") || "mpesa");
  const note = String(formData.get("note") || "").trim() || null;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return { error: "Enter the amount received" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date" };

  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!existing) return { error: "No subscription record for this org" };

  await db.insert(billingPayments).values({
    orgId,
    kind: "maintenance",
    amountCents,
    method,
    state: "applied",
    note,
    createdAt: date,
    updatedAt: new Date().toISOString(),
  });
  const base = existing.nextMaintenanceDueAt && existing.nextMaintenanceDueAt > date ? existing.nextMaintenanceDueAt : date;
  await db.update(subscriptions).set({ nextMaintenanceDueAt: nextMonthEndISO(base) }).where(eq(subscriptions.id, existing.id));

  await logAdminAction({
    actorEmail: user.email!,
    action: "record_maintenance_payment",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: KSh ${(amountCents / 100).toLocaleString("en-KE")} recorded (${method}), ${date}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/billing-payments");
  return { success: true };
}

const MODULE_LABELS: Record<string, string> = { crm: "CRM", accounting: "Accounting", payroll: "Payroll" };

/** Record a one-off module payment (e.g. an org that started on CRM-only
 *  later paying for Accounting) and switch that module on for them —
 *  separate from the single setup-fee field, which only ever fires once at
 *  initial activation. Repeatable any time, for any of the three modules. */
export async function recordModulePaymentAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();

  const moduleKey = String(formData.get("module") || "");
  if (!MODULE_LABELS[moduleKey]) return { error: "Pick a module" };
  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  const date = String(formData.get("date") || "");
  const note = String(formData.get("note") || "").trim() || null;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return { error: "Enter the amount received" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date" };

  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };

  await db.insert(billingPayments).values({
    orgId,
    kind: "module_fee",
    moduleKey,
    amountCents,
    method: "mpesa",
    state: "applied",
    note,
    createdAt: date,
    updatedAt: new Date().toISOString(),
  });
  await db
    .update(org)
    .set({ [`${moduleKey}Enabled`]: true } as Record<string, boolean>)
    .where(eq(org.id, orgId));

  await logAdminAction({
    actorEmail: user.email!,
    action: "record_module_payment",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: ${MODULE_LABELS[moduleKey]} module paid, KSh ${(amountCents / 100).toLocaleString("en-KE")} recorded, ${date}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/admin/billing-payments");
  return { success: true };
}

/** Toggle which modules an org's staff actually see in the sidebar — UI
 *  visibility only, the underlying ledger/payroll never stops running (see
 *  org.crmEnabled/accountingEnabled/payrollEnabled in schema.ts). */
export async function setOrgModuleAccessAction(orgId: number, formData: FormData) {
  const user = await requireSuperAdmin();
  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };

  const crmEnabled = formData.get("crmEnabled") === "on";
  const accountingEnabled = formData.get("accountingEnabled") === "on";
  const payrollEnabled = formData.get("payrollEnabled") === "on";

  await db.update(org).set({ crmEnabled, accountingEnabled, payrollEnabled }).where(eq(org.id, orgId));

  await logAdminAction({
    actorEmail: user.email!,
    action: "set_module_access",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: CRM ${crmEnabled ? "on" : "off"}, Accounting ${accountingEnabled ? "on" : "off"}, Payroll ${payrollEnabled ? "on" : "off"}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  revalidatePath("/");
  return { success: true };
}

/** Hard-suspend an org's access — explicit admin hard-stop (e.g. a churned client). */
export async function suspendOrgAction(orgId: number) {
  const user = await requireSuperAdmin();
  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!existing) return { error: "No subscription record for this org" };

  await db.update(subscriptions).set({ billingStatus: "suspended" }).where(eq(subscriptions.id, existing.id));
  // A suspended client shouldn't keep accumulating draft maintenance invoices.
  await setPlatformTemplateActive(orgId, false);
  await logAdminAction({
    actorEmail: user.email!,
    action: "suspend_org",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: access suspended`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  return { success: true };
}

/** Reinstate a suspended org back to active, without touching its fee/due date. */
export async function reinstateOrgAction(orgId: number) {
  const user = await requireSuperAdmin();
  const [o] = await db.select({ id: org.id, name: org.name }).from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) return { error: "Org not found" };
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!existing) return { error: "No subscription record for this org" };

  await db.update(subscriptions).set({ billingStatus: "active" }).where(eq(subscriptions.id, existing.id));
  // Resume the operator's own maintenance invoice, and pick up any fee
  // change made while suspended.
  await ensurePlatformContactAndTemplate(orgId);
  await setPlatformTemplateActive(orgId, true);
  await syncPlatformInvoiceAmount(orgId);
  await logAdminAction({
    actorEmail: user.email!,
    action: "reinstate_org",
    targetType: "org",
    targetId: orgId,
    detail: `${o.name || `Org #${orgId}`}: access reinstated`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  return { success: true };
}

export async function createAnnouncementAction(formData: FormData) {
  const user = await requireSuperAdmin();

  const message = String(formData.get("message") || "").trim();
  const tone = formData.get("tone") === "warn" ? "warn" : "info";
  if (!message) return { error: "Write a message first" };
  if (message.length > 200) return { error: "Keep it under 200 characters" };

  // One active announcement at a time — new one replaces the old
  await db.update(announcements).set({ active: false }).where(eq(announcements.active, true));
  await db.insert(announcements).values({
    message,
    tone,
    active: true,
    createdBy: user.email,
    createdAt: new Date().toISOString(),
  });
  await logAdminAction({ actorEmail: user.email!, action: "announcement_publish", detail: `[${tone}] ${message}` });
  revalidatePath("/admin/announcements");
  return { success: true };
}

export async function deactivateAnnouncementAction(id: number) {
  const user = await requireSuperAdmin();
  await db.update(announcements).set({ active: false }).where(eq(announcements.id, id));
  await logAdminAction({ actorEmail: user.email!, action: "announcement_retract", targetId: id });
  revalidatePath("/admin/announcements");
  return { success: true };
}

/** Toggle a per-org feature override (beta/pilot tool — grants the feature regardless of plan). */
export async function toggleFeatureFlagAction(orgId: number, flag: string) {
  const user = await requireSuperAdmin();

  const allowed = ["gateways", "sms", "payouts", "portal", "recurring", "payroll"];
  if (!allowed.includes(flag)) return { error: "Unknown feature" };

  const { featureFlags } = await import("@/db");
  const { and } = await import("drizzle-orm");
  const [existing] = await db.select().from(featureFlags)
    .where(and(eq(featureFlags.orgId, orgId), eq(featureFlags.flag, flag))).limit(1);

  if (existing) {
    await db.delete(featureFlags).where(eq(featureFlags.id, existing.id));
  } else {
    await db.insert(featureFlags).values({ orgId, flag, createdBy: user.email, createdAt: new Date().toISOString() });
  }
  await logAdminAction({
    actorEmail: user.email!,
    action: "feature_flag_toggle",
    targetType: "org",
    targetId: orgId,
    detail: `${flag}: ${existing ? "revoked" : "granted"}`,
  });
  revalidatePath(`/admin/orgs/${orgId}`);
  return { success: true, enabled: !existing };
}
