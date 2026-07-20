import { db, billingPayments, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { PlanKey } from "./billing";

/**
 * Activate/extend a subscription from a COMPLETE billing payment.
 * Idempotent: flips the payment row to "applied" and only acts on the first call —
 * safe to invoke from both the status poll and the webhook.
 */
export async function applyBillingPayment(paymentId: number): Promise<boolean> {
  const [p] = await db.select().from(billingPayments).where(eq(billingPayments.id, paymentId)).limit(1);
  if (!p || p.state === "applied") return false;

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, p.orgId)).limit(1);

  // Renewing the same plan before expiry extends from paidUntil; everything else starts today
  const base =
    existing && existing.plan === p.plan && existing.paidUntil > today && existing.paidUntil < "9000-01-01"
      ? new Date(existing.paidUntil)
      : now;
  base.setDate(base.getDate() + (p.cycle === "annual" ? 365 : 30));
  const paidUntil = base.toISOString().slice(0, 10);

  if (existing) {
    await db.update(subscriptions)
      .set({ plan: p.plan as PlanKey, paidUntil, status: "active" })
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      orgId: p.orgId,
      plan: p.plan as PlanKey,
      paidUntil,
      status: "active",
      createdAt: new Date().toISOString(),
    });
  }

  await db.update(billingPayments)
    .set({ state: "applied", updatedAt: new Date().toISOString() })
    .where(eq(billingPayments.id, paymentId));
  return true;
}
