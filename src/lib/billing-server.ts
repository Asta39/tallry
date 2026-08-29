import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { Entitlements, resolveBillingAccess, addDaysISO } from "./billing";

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
    .values({ orgId, billingStatus: "trial", trialEndsAt: addDaysISO(today, 7), createdAt: now })
    .onConflictDoNothing({ target: subscriptions.orgId });

  const [healed] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1);
  return resolveBillingAccess(healed);
}
