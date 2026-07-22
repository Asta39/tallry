import { NextResponse } from "next/server";
import { db, billingPayments } from "@/db";
import { eq } from "drizzle-orm";
import { applyBillingPayment } from "@/lib/billing-apply";

/**
 * IntaSend webhook for Zeno subscription payments — safety net for the
 * client-side status poll (covers "paid but closed the tab").
 *
 * Configure in the IntaSend dashboard: URL https://<domain>/api/payments/intasend,
 * challenge = INTASEND_WEBHOOK_CHALLENGE env value. IntaSend echoes the challenge
 * in every payload; mismatch → reject.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const expected = process.env.INTASEND_WEBHOOK_CHALLENGE;
    if (!expected || body?.challenge !== expected) {
      return new Response("Invalid challenge", { status: 403 });
    }

    const invoiceId: string | undefined = body?.invoice_id;
    const state: string | undefined = body?.state;
    if (!invoiceId) return NextResponse.json({ ok: true });

    const [p] = await db.select().from(billingPayments).where(eq(billingPayments.invoiceId, invoiceId)).limit(1);
    if (!p) return NextResponse.json({ ok: true }); // not one of ours (e.g. unrelated collection)

    if (state === "COMPLETE") {
      await applyBillingPayment(p.id);
    } else if (state === "FAILED" && p.state !== "applied") {
      await db.update(billingPayments)
        .set({ state: "FAILED", failedReason: body?.failed_reason || null, updatedAt: new Date().toISOString() })
        .where(eq(billingPayments.id, p.id));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("IntaSend webhook error:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
