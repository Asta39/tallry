"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { PLANS, PlanKey, BillingCycle } from "@/lib/billing";

/**
 * DEMO ONLY: simulates an STK push and grants the plan without taking any
 * payment. Until M-Pesa Daraja / KopoKopo billing collection is live, this
 * must never run in production — real customers must not get paid plans
 * for free. Gate: only runs when SIMULATED_BILLING_ENABLED=true, which
 * should stay unset in the Vercel production environment.
 */
export async function simulateSubscriptionUpgradeAction(plan: PlanKey, cycle: BillingCycle, mpesaPhone: string) {
  try {
    if (process.env.SIMULATED_BILLING_ENABLED !== "true") {
      return {
        error:
          "Online upgrades aren't live yet — M-Pesa payment collection is being set up. Contact us to upgrade your plan for now.",
      };
    }
    await requirePerm("settings");
    const o = await getOrg();

    if (!PLANS[plan]) return { error: "Invalid plan selected" };

    // Simulate STK push delay (e.g. 5 seconds for the user to enter PIN on their phone)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const today = new Date();
    // Add 30 days for monthly, 365 for annual
    if (cycle === "annual") {
      today.setDate(today.getDate() + 365);
    } else {
      today.setDate(today.getDate() + 30);
    }
    const paidUntil = today.toISOString().split("T")[0];

    // Check if sub exists
    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, o.id)).limit(1);

    if (existing) {
      await db.update(subscriptions)
        .set({ plan, paidUntil } as any)
        .where(eq(subscriptions.orgId, o.id));
    } else {
      await db.insert(subscriptions).values({
        orgId: o.id,
        plan,
        paidUntil,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to upgrade subscription" };
  }
}
