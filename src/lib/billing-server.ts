import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { Entitlements, resolveBillingAccess } from "./billing";

export async function getEntitlements(orgId: number): Promise<Entitlements> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!sub) {
    // Fallback if no sub exists, though seedOrgDefaults() should have created
    // one — full access rather than locking someone out over a data gap.
    const today = new Date().toISOString().slice(0, 10);
    return {
      status: "trial",
      trialEndsAt: today,
      trialDaysLeft: 7,
      monthlyFeeCents: 0,
      nextMaintenanceDueAt: null,
    };
  }

  return resolveBillingAccess(sub);
}
