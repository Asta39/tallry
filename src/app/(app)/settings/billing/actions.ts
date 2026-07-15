"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { PLANS, PlanKey, BillingCycle } from "@/lib/billing";

export async function simulateSubscriptionUpgradeAction(plan: PlanKey, cycle: BillingCycle, mpesaPhone: string) {
  try {
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
