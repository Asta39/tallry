import { db, subscriptions, members } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { Entitlements, resolveBillingAccess, addDaysISO, PER_STAFF_MONTHLY_FEE_CENTS, TRIAL_DAYS } from "./billing";

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (sub) return resolveBillingAccess(sub);

  // Self-heal: seedOrgDefaults() should have created this row at signup —
  // if it's missing (a partial-seed failure, or an org that predates the
  // trial system), create a real one now instead of serving fabricated
  // numbers forever. The previous fallback here hardcoded trialEndsAt to
  // *today* while separately hardcoding trialDaysLeft to 7 — two numbers
  // that don't agree with each other, which is exactly the "trial ends
  // today, not in 7 days" bug this replaces. idx_subscriptions_org is a
  // unique index on orgId, so a concurrent duplicate insert (two requests
  // hitting this at once) is safely ignored rather than erroring.
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  await db
    .insert(subscriptions)
    .values({ orgId, billingStatus: "trial", trialEndsAt: addDaysISO(today, TRIAL_DAYS), createdAt: now })
    .onConflictDoNothing({ target: subscriptions.orgId });

  const [healed] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  return resolveBillingAccess(healed);
}

/**
 * Keeps an active org's per-seat monthly fee in sync with its actual seat
 * count (owner + active staff) — called after any staff create/activate/
 * deactivate so the admin never has to remember to hit "Recalc" by hand.
 * No-op for trial/locked/suspended orgs, since the fee is meaningless until
 * they're active. Always overwrites monthlyFeeCents to the formula result —
 * that's the point: it's meant to stay in lockstep with headcount, not
 * preserve a stale manual override.
 */
export async function syncSeatFee(orgId: number): Promise<void> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  if (!sub || sub.billingStatus !== "active") return;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.active, true)));
  const seats = count + 1; // +1 for the owner, who never gets a members row
  const monthlyFeeCents = seats * PER_STAFF_MONTHLY_FEE_CENTS;

  if (monthlyFeeCents !== sub.monthlyFeeCents) {
    await db.update(subscriptions).set({ monthlyFeeCents }).where(eq(subscriptions.id, sub.id));
  }
}
