"use server";

import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, billingPayments } from "@/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getEntitlements } from "@/lib/billing-server";
import { intasendStkPush, intasendStatus, intasendCheckout, normalizeKenyanPhone } from "@/lib/payments/intasend";
import { headers } from "next/headers";
import { applyBillingPayment } from "@/lib/billing-apply";

async function currentMonthlyFeeCents(orgId: number): Promise<number> {
  const ents = await getEntitlements(orgId);
  if (ents.monthlyFeeCents <= 0) throw new Error("No maintenance fee has been set for your account yet — contact us.");
  return ents.monthlyFeeCents;
}

/** Kick off a real IntaSend M-Pesa STK push for this org's monthly maintenance fee. */
export async function initiateMaintenancePaymentAction(mpesaPhone: string) {
  try {
    await requirePerm("settings");
    const o = await getOrg();
    const amountCents = await currentMonthlyFeeCents(o.id);
    const phone = normalizeKenyanPhone(mpesaPhone);

    const [row] = await db.insert(billingPayments).values({
      orgId: o.id,
      kind: "maintenance",
      amountCents,
      phone,
      createdAt: new Date().toISOString(),
    }).returning();

    const { invoiceId, state } = await intasendStkPush({
      amountKes: Math.round(amountCents / 100),
      phone,
      apiRef: `zeno-maint-${row.id}`,
      narrative: `Zeno monthly maintenance fee`,
    });

    await db.update(billingPayments)
      .set({ invoiceId, state, updatedAt: new Date().toISOString() })
      .where(eq(billingPayments.id, row.id));

    return { paymentId: row.id };
  } catch (e: any) {
    return { error: e.message || "Could not start the payment — try again" };
  }
}

/** Kick off a card payment via IntaSend hosted checkout for this org's monthly maintenance fee. */
export async function initiateMaintenanceCardPaymentAction(email: string) {
  try {
    await requirePerm("settings");
    const o = await getOrg();
    if (!email || !email.includes("@")) return { error: "Enter a valid email address" };
    const amountCents = await currentMonthlyFeeCents(o.id);

    const [row] = await db.insert(billingPayments).values({
      orgId: o.id,
      kind: "maintenance",
      amountCents,
      method: "card",
      email,
      createdAt: new Date().toISOString(),
    }).returning();

    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;

    const { id, url } = await intasendCheckout({
      amountKes: Math.round(amountCents / 100),
      email,
      apiRef: `zeno-maint-${row.id}`,
      comment: `Zeno monthly maintenance fee`,
      redirectUrl: `${origin}/settings/billing?payment=${row.id}`,
      host: origin,
    });

    await db.update(billingPayments)
      .set({ invoiceId: id, state: "PENDING", updatedAt: new Date().toISOString() })
      .where(eq(billingPayments.id, row.id));

    return { paymentId: row.id, checkoutUrl: url };
  } catch (e: any) {
    return { error: e.message || "Could not start the payment — try again" };
  }
}

/**
 * Poll a pending payment. Returns "complete" once applied, "failed" with a
 * reason, or "pending" while the customer is entering their PIN.
 */
export async function checkMaintenancePaymentAction(paymentId: number) {
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
      await db.update(billingPayments).set({ state: "COMPLETE", updatedAt: new Date().toISOString() }).where(eq(billingPayments.id, p.id));
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
