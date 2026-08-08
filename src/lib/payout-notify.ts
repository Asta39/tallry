"use server";

import { db, org } from "@/db";
import { eq } from "drizzle-orm";
import { getOrgSmsConfig, sendSms, normalizeKePhone } from "@/lib/sms";
import { fmtKES } from "@/lib/money";
import { shortRef } from "@/lib/payments/ref-format";

/**
 * Texts org.accountantNotifyPhone a confirmation every time a bill or
 * expense claim is actually paid out via gateway — whoever paid it
 * (admin or accountant), the accountant gets the same real confirmation
 * (reference number, amount, destination) instead of having to call
 * whoever's phone triggered it to ask "did that go through?". Best-effort:
 * never throws, a missing phone/SMS config just means no text goes out.
 */
export async function notifyAccountantOfPayout(
  orgId: number,
  params: {
    label: string;
    amountCents: number;
    destination: string;
    providerRef: string;
    gatewayId: string;
    /** Both gateways only hand back their own internal request id at payout
     *  time — the real transaction code (what actually shows up on the
     *  recipient's phone) only arrives later via webhook. Pass false for the
     *  immediate post-payout text so it doesn't quote that meaningless
     *  internal id as if it were the real reference; the webhook handler
     *  sends a follow-up with confirmed: true once the real code lands. */
    confirmed?: boolean;
  }
) {
  try {
    const [orgRow] = await db.select().from(org).where(eq(org.id, orgId)).limit(1);
    if (!orgRow?.accountantNotifyPhone) return;
    const recipient = normalizeKePhone(orgRow.accountantNotifyPhone);
    if (!recipient) return;
    const cfg = await getOrgSmsConfig(orgId);
    if (!cfg) return;

    const gatewayName = params.gatewayId === "mpesa_daraja" ? "M-Pesa" : params.gatewayId === "kopokopo" ? "Kopo Kopo" : params.gatewayId;
    const confirmed = params.confirmed ?? true;
    const message = confirmed
      ? `${orgRow.name || "Zeno"}: ${fmtKES(params.amountCents)} paid out to ${params.destination} for ${params.label} via ${gatewayName}. Ref: ${shortRef(params.providerRef)}`
      : `${orgRow.name || "Zeno"}: ${fmtKES(params.amountCents)} sent to ${params.destination} for ${params.label} via ${gatewayName}. Confirming reference shortly.`;
    await sendSms(cfg, recipient, message);
  } catch (e) {
    console.error("notifyAccountantOfPayout failed", e);
  }
}
