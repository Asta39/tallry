"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, subscriptions, billingPayments } from "@/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { PLANS, PlanKey, BillingCycle } from "@/lib/billing";
import { intasendStkPush, intasendStatus, normalizeKenyanPhone } from "@/lib/payments/intasend";
import { applyBillingPayment } from "@/lib/billing-apply";

/** Kick off a real IntaSend M-Pesa STK push for a plan upgrade/renewal. */
export async function initiateSubscriptionPaymentAction(plan: PlanKey, cycle: BillingCycle, mpesaPhone: string) {
  try {
    await requirePerm("settings");
    const o = await getOrg();

    if (!PLANS[plan] || plan === "free") return { error: "Invalid plan selected" };
    const amountCents = cycle === "annual" ? PLANS[plan].annualCents : PLANS[plan].monthlyCents;
    const phone = normalizeKenyanPhone(mpesaPhone);

    const [row] = await db.insert(billingPayments).values({
      orgId: o.id,
      plan,
      cycle,
      amountCents,
      phone,
      createdAt: new Date().toISOString(),
    }).returning();

    const { invoiceId, state } = await intasendStkPush({
      amountKes: Math.round(amountCents / 100),
      phone,
      apiRef: `zeno-sub-${row.id}`,
      narrative: `Zeno ${PLANS[plan].name} plan (${cycle})`,
    });

    await db.update(billingPayments)
      .set({ invoiceId, state, updatedAt: new Date().toISOString() })
      .where(eq(billingPayments.id, row.id));

    return { paymentId: row.id };
  } catch (e: any) {
    return { error: e.message || "Could not start the payment — try again" };
  }
}

/**
 * Poll a pending payment. Returns "complete" once the subscription is active,
 * "failed" with a reason, or "pending" while the customer is entering their PIN.
 */
export async function checkSubscriptionPaymentAction(paymentId: number) {
  try {
    await requirePerm("settings");
    const o = await getOrg();

    const [p] = await db.select().from(billingPayments)
      .where(and(eq(billingPayments.id, paymentId), eq(billingPayments.orgId, o.id))).limit(1);
    if (!p) return { error: "Payment not found" };
    if (p.state === "applied") return { status: "complete" as const };
    if (p.state === "FAILED") return { status: "failed" as const, reason: p.failedReason || "Payment failed" };
    if (!p.invoiceId) return { error: "Payment was never started" };

    const s = await intasendStatus(p.invoiceId);
    if (s.state === "COMPLETE") {
      await applyBillingPayment(p.id);
      revalidatePath("/", "layout");
      return { status: "complete" as const };
    }
    if (s.state === "FAILED") {
      await db.update(billingPayments)
        .set({ state: "FAILED", failedReason: s.failedReason, updatedAt: new Date().toISOString() })
        .where(eq(billingPayments.id, p.id));
      return { status: "failed" as const, reason: s.failedReason || "Payment failed or was cancelled" };
    }
    return { status: "pending" as const };
  } catch (e: any) {
    return { error: e.message || "Could not check payment status" };
  }
}

/**
 * DEMO ONLY: simulates an upgrade without payment. Gate: SIMULATED_BILLING_ENABLED=true,
 * which must stay unset in production.
 */
export async function simulateSubscriptionUpgradeAction(plan: PlanKey, cycle: BillingCycle, _mpesaPhone: string) {
  try {
    if (process.env.SIMULATED_BILLING_ENABLED !== "true") {
      return { error: "Simulated billing is disabled." };
    }
    await requirePerm("settings");
    const o = await getOrg();

    if (!PLANS[plan]) return { error: "Invalid plan selected" };

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const today = new Date();
    today.setDate(today.getDate() + (cycle === "annual" ? 365 : 30));
    const paidUntil = today.toISOString().split("T")[0];

    const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, o.id)).limit(1);
    if (existing) {
      await db.update(subscriptions).set({ plan, paidUntil }).where(eq(subscriptions.orgId, o.id));
    } else {
      await db.insert(subscriptions).values({ orgId: o.id, plan, paidUntil, createdAt: new Date().toISOString() });
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "Failed to upgrade subscription" };
  }
}
