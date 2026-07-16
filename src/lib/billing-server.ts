import { db, subscriptions, documents, members } from "@/db";
import { eq, and, sql, gte, inArray } from "drizzle-orm";
import { PLANS, PlanKey, Entitlements } from "./billing";

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!sub) {
    // Fallback if no sub exists, though we should create it on org creation
    return {
      plan: "free",
      isReadOnly: false,
      limits: PLANS.free,
      paidUntil: "9999-12-31",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const isReadOnly = sub.paidUntil < today;
  const planKey = (PLANS[sub.plan as PlanKey] ? sub.plan : "free") as PlanKey;

  return {
    plan: planKey,
    isReadOnly,
    limits: PLANS[planKey],
    paidUntil: sub.paidUntil,
  };
}

/** Invoices + quotes created this month — the free-tier cap covers both, per the pricing page. */
export async function getInvoiceUsage(orgId: number): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        inArray(documents.type, ["invoice", "quote"]),
        gte(documents.createdAt, startOfMonth)
      )
    );

  return Number(result.count || 0);
}

/**
 * Server-side gate for a boolean plan feature (recurring, gateways, payroll,
 * portal, sms, payouts). Throws with a message safe to show the user.
 * Call this INSIDE the mutating server action, not just the page — the page
 * blur is cosmetic and doesn't stop a direct call to the action.
 */
export async function assertFeatureEntitlement(
  orgId: number,
  feature: keyof Pick<
    (typeof PLANS)["free"],
    "recurring" | "gateways" | "payroll" | "portal" | "sms" | "payouts"
  >
): Promise<void> {
  const ents = await getEntitlements(orgId);
  if (ents.isReadOnly) {
    throw new Error("Your subscription has expired. Please upgrade to continue.");
  }
  if (!ents.limits[feature]) {
    throw new Error(`This feature needs a higher plan. Upgrade in Settings → Billing to unlock it.`);
  }
}

/** Server-side gate for the monthly invoice+quote cap. Throws when at/over the limit. */
export async function assertInvoiceCapacity(orgId: number): Promise<void> {
  const ents = await getEntitlements(orgId);
  if (ents.isReadOnly) {
    throw new Error("Your subscription has expired. Please upgrade to continue.");
  }
  if (ents.limits.invoices === -1) return;
  const usage = await getInvoiceUsage(orgId);
  if (usage >= ents.limits.invoices) {
    throw new Error(
      `You've reached your monthly limit of ${ents.limits.invoices} invoices/quotes on the ${ents.limits.name} plan. Upgrade in Settings → Billing to continue.`
    );
  }
}

/** Server-side gate for the staff-seat cap. Throws when at/over the limit. */
export async function assertStaffCapacity(orgId: number): Promise<void> {
  const ents = await getEntitlements(orgId);
  if (ents.isReadOnly) {
    throw new Error("Your subscription has expired. Please upgrade to continue.");
  }
  if (ents.limits.staff === -1) return;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(members)
    .where(eq(members.orgId, orgId));
  const count = Number(row?.count || 0);
  if (count >= ents.limits.staff) {
    throw new Error(
      `You've reached your staff-seat limit of ${ents.limits.staff} on the ${ents.limits.name} plan. Upgrade in Settings → Billing to add more.`
    );
  }
}
