"use server";

import { db, org } from "@/db";
import { eq } from "drizzle-orm";
import { getOrgSmsConfig, sendSms, normalizeKePhone } from "@/lib/sms";
import { fmtKES } from "@/lib/money";

/** Gateway provider refs are long UUIDs (Kopo Kopo) or verbose conversation
 *  ids (Daraja) — unreadable in an SMS. Compress to the last 8 alphanumeric
 *  characters, uppercased, as a short code the accountant can actually read
 *  back or note down; still specific enough per payout to be useful for a
 *  quick "does this match what I see" check. */
function shortRef(providerRef: string): string {
  const alnum = (providerRef || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return alnum.slice(-8) || providerRef;
}

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
  params: { label: string; amountCents: number; destination: string; providerRef: string; gatewayId: string }
) {
  try {
    const [orgRow] = await db.select().from(org).where(eq(org.id, orgId)).limit(1);
    if (!orgRow?.accountantNotifyPhone) return;
    const recipient = normalizeKePhone(orgRow.accountantNotifyPhone);
    if (!recipient) return;
    const cfg = await getOrgSmsConfig(orgId);
    if (!cfg) return;

    const gatewayName = params.gatewayId === "mpesa_daraja" ? "M-Pesa" : params.gatewayId === "kopokopo" ? "Kopo Kopo" : params.gatewayId;
    await sendSms(
      cfg,
      recipient,
      `${orgRow.name || "Zeno"}: ${fmtKES(params.amountCents)} paid out to ${params.destination} for ${params.label} via ${gatewayName}. Ref: ${shortRef(params.providerRef)}`
    );
  } catch (e) {
    console.error("notifyAccountantOfPayout failed", e);
  }
}
