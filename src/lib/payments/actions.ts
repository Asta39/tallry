"use server";

import crypto from "crypto";
import { requirePerm } from "@/lib/guard";
import { getGateway } from "@/lib/payments/gateway";
import { db, documents, paymentGateways, paymentEvents, contacts, bankAccounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { recordPayment } from "@/lib/actions";
import { notifyAccountantOfPayout } from "@/lib/payout-notify";
import { shortRef } from "@/lib/payments/ref-format";

function isNextRedirect(err: any): boolean {
  return typeof err?.digest === "string" && err.digest.startsWith("NEXT_REDIRECT");
}

export async function requestPaymentAction(documentId: number, phone: string, amountCents: number, gatewayId: string) {
  try {
    await requirePerm("invoices");
    const o = await getOrg();

    if (!Number.isInteger(amountCents) || amountCents <= 0) return { error: "Invalid amount" };

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
    if (!doc) return { error: "Document not found" };
    if (doc.type !== "invoice") return { error: "Can only request payment for invoices" };

    const outstanding = doc.totalCents - doc.paidCents;
    if (amountCents > outstanding) return { error: "Amount exceeds invoice outstanding balance" };

    const [gwConfig] = await db.select().from(paymentGateways).where(and(
      eq(paymentGateways.orgId, o.id),
      eq(paymentGateways.enabled, true),
      eq(paymentGateways.gatewayId, gatewayId)
    ));
    if (!gwConfig) return { error: "Selected payment gateway is not connected or enabled" };

    const [contact] = doc.contactId
      ? await db.select().from(contacts).where(and(eq(contacts.id, doc.contactId), eq(contacts.orgId, o.id)))
      : [undefined];

    const gateway = getGateway(gwConfig);

    const result = await gateway.requestPayment({
      phone,
      amountCents,
      accountRef: doc.number,
      description: `Payment for Invoice ${doc.number}`,
      payerName: contact?.displayName || contact?.companyName || undefined,
      payerEmail: contact?.email || undefined,
    });

    // Save a pending payment event linked to this specific invoice.
    // When the webhook callback arrives, it will look up this pending event
    // by providerRef (CheckoutRequestID for Daraja, Location for KopoKopo),
    // verify the amount, and immediately know which invoice to apply to.
    await db.insert(paymentEvents).values({
      orgId: o.id,
      gatewayId,
      providerRef: result.providerRef,
      amountCents,
      payerPhone: phone,
      accountRef: doc.number,
      status: "pending",
      matchedDocumentId: documentId,
      rawJson: JSON.stringify({ stkPushRef: result.providerRef, phone, amountCents }),
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: [paymentEvents.gatewayId, paymentEvents.providerRef] });

    return { success: true };
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    return { error: err.message || "Failed to request payment" };
  }
}

export async function payOutAction(documentId: number, destination: string, destinationType: "phone" | "till" | "paybill", amountCents: number, gatewayId: string, accountNumber?: string) {
  try {
    await requirePerm("can_payout");
    const o = await getOrg();

    if (!Number.isInteger(amountCents) || amountCents <= 0) return { error: "Invalid amount" };
    if (amountCents % 100 !== 0) return { error: "Payouts must be a whole shilling amount" };

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
    if (!doc) return { error: "Document not found" };
    if (doc.type !== "bill" && doc.type !== "expense") return { error: "Can only payout for bills or expenses" };

    const outstanding = doc.totalCents - doc.paidCents;
    if (amountCents > outstanding) return { error: "Amount exceeds outstanding balance on this document" };

    const [gwConfig] = await db.select().from(paymentGateways).where(and(
      eq(paymentGateways.orgId, o.id),
      eq(paymentGateways.enabled, true),
      eq(paymentGateways.gatewayId, gatewayId)
    ));
    if (!gwConfig) return { error: "Selected payment gateway is not connected or enabled" };

    const gateway = getGateway(gwConfig);

    if (destinationType === "paybill" && !accountNumber?.trim()) {
      return { error: "Enter the account number for the receiving paybill" };
    }

    const [payee] = doc.contactId
      ? await db.select({ name: contacts.displayName, email: contacts.email }).from(contacts).where(and(eq(contacts.id, doc.contactId), eq(contacts.orgId, o.id)))
      : [];

    // Placeholder inserted BEFORE the gateway call — if payOut() throws after
    // the provider already moved the money (e.g. our request times out
    // reading the response), the old code left zero trace of the attempt.
    // Now a "pending" row survives so it can be reconciled against the SMS
    // confirmation on the recipient's/accountant's phone instead of the
    // system silently showing nothing happened.
    const tempRef = `pending:${crypto.randomUUID()}`;
    const [placeholder] = await db.insert(paymentEvents).values({
      orgId: o.id,
      gatewayId,
      providerRef: tempRef,
      direction: "out",
      amountCents,
      payerPhone: destinationType === "phone" ? destination : undefined,
      accountRef: doc.number,
      status: "pending",
      matchedDocumentId: documentId,
      rawJson: JSON.stringify({ destination, destinationType, amountCents }),
      createdAt: new Date().toISOString(),
    }).returning({ id: paymentEvents.id });

    let result: Awaited<ReturnType<typeof gateway.payOut>>;
    try {
      result = await gateway.payOut({
        destination,
        destinationType,
        accountNumber: accountNumber?.trim() || undefined,
        amountCents,
        accountRef: doc.number,
        payeeName: payee?.name || undefined,
        payeeEmail: payee?.email || undefined,
        reason: `Payout for ${doc.type} ${doc.number}`
      });
    } catch (e: any) {
      await db.update(paymentEvents).set({ status: "failed", rawJson: JSON.stringify({ destination, destinationType, amountCents, error: e?.message }) }).where(eq(paymentEvents.id, placeholder.id));
      throw e;
    }

    // Recorded as already applied and posted immediately below, rather than
    // 'pending' waiting on the gateway's async settlement webhook — that
    // webhook is what the "Stuck Payouts" screen exists to unstick, and most
    // admin-initiated payouts were routinely landing there because KopoKopo's
    // settlement callback is slow/unreliable, not because anything was
    // actually wrong. The gateway call above already succeeded (or this
    // throws), so the accountant needs the balance to move now — same
    // reasoning as the expense-claim gateway payout path.
    await db.update(paymentEvents).set({
      providerRef: result.providerRef,
      status: "applied",
      rawJson: JSON.stringify({ payoutRef: result.providerRef, destination, destinationType, amountCents }),
    }).where(eq(paymentEvents.id, placeholder.id));

    const [mpesaBank] = await db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false))).limit(1);

    const paymentId = await recordPayment({
      direction: "out",
      documentId,
      date: new Date().toISOString().split("T")[0],
      amountCents,
      method: gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
      // Kopo Kopo/Daraja provider refs are long UUIDs/conversation ids — not
      // what shows up on the payer's phone. Same short form used in the SMS.
      reference: shortRef(result.providerRef),
      bankAccountId: mpesaBank?.id,
    });
    // Kept so a later "disbursement actually failed" webhook can find and
    // reverse this exact payment — see reverseFailedGatewayPayout in webhook.ts.
    await db.update(paymentEvents).set({ paymentId }).where(eq(paymentEvents.id, placeholder.id));

    await notifyAccountantOfPayout(o.id, {
      label: `${doc.type} ${doc.number}`,
      amountCents,
      destination,
      providerRef: result.providerRef,
      gatewayId,
      confirmed: false,
    });

    return { success: true };
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    return { error: err.message || "Failed to process payout" };
  }
}
