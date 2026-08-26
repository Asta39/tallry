import { db, billingPayments, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { nextMonthEndISO } from "./billing";

/**
 * Apply a COMPLETE maintenance-fee payment: advances the org's
 * nextMaintenanceDueAt by one month and marks the payment row "applied".
 * Idempotent — flips the payment row to "applied" and only acts on the
 * first call, safe to invoke from both the status poll and the webhook.
 * Only ever called for kind:"maintenance" — the one-time setup fee is
 * always recorded manually by the admin (see admin/actions.ts).
 */
export async function applyBillingPayment(paymentId: number): Promise<boolean> {
  const [p] = await db.select().from(billingPayments).where(eq(billingPayments.id, paymentId)).limit(1);
  if (!p || p.state === "applied") return false;

  const today = new Date().toISOString().slice(0, 10);
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, p.orgId)).limit(1);
  if (sub) {
    // Paying before the due date extends from the current due date rather
    // than from today, so paying early doesn't shorten the next cycle.
    const base = sub.nextMaintenanceDueAt && sub.nextMaintenanceDueAt > today ? sub.nextMaintenanceDueAt : today;
    await db.update(subscriptions)
      .set({ nextMaintenanceDueAt: nextMonthEndISO(base) })
      .where(eq(subscriptions.id, sub.id));
  }

  await db.update(billingPayments)
    .set({ state: "applied", updatedAt: new Date().toISOString() })
    .where(eq(billingPayments.id, paymentId));
  return true;
}
