"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { PLANS, PlanKey } from "@/lib/billing";

export async function simulateSubscriptionUpgradeAction(plan: PlanKey) {
  try {
    await requirePerm("settings");
    const o = await getOrg();

    if (!PLANS[plan]) return { error: "Invalid plan selected" };

    const today = new Date();
    // 30 days from today
    today.setDate(today.getDate() + 30);
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
