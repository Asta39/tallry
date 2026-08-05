"use server";

import { requirePerm } from "@/lib/guard";
import { getGateway } from "@/lib/payments/gateway";
import { db, documents, paymentGateways, paymentEvents, contacts, bankAccounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { recordPayment } from "@/lib/actions";

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

    const result = await gateway.payOut({
      destination,
      destinationType,
      accountNumber: accountNumber?.trim() || undefined,
      amountCents,
      accountRef: doc.number,
      payeeName: payee?.name || undefined,
      payeeEmail: payee?.email || undefined,
      reason: `Payout for ${doc.type} ${doc.number}`
    });

    // Recorded as already applied and posted immediately below, rather than
    // 'pending' waiting on the gateway's async settlement webhook — that
    // webhook is what the "Stuck Payouts" screen exists to unstick, and most
    // admin-initiated payouts were routinely landing there because KopoKopo's
    // settlement callback is slow/unreliable, not because anything was
    // actually wrong. The gateway call above already succeeded (or this
    // throws), so the accountant needs the balance to move now — same
    // reasoning as the expense-claim gateway payout path.
    await db.insert(paymentEvents).values({
      orgId: o.id,
      gatewayId,
      providerRef: result.providerRef,
      direction: "out",
      amountCents,
      payerPhone: destinationType === "phone" ? destination : undefined,
      accountRef: doc.number,
      status: "applied",
      matchedDocumentId: documentId,
      rawJson: JSON.stringify({ payoutRef: result.providerRef, destination, destinationType, amountCents }),
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: [paymentEvents.gatewayId, paymentEvents.providerRef] });

    const [mpesaBank] = await db.select({ id: bankAccounts.id }).from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false))).limit(1);

    await recordPayment({
      direction: "out",
      documentId,
      date: new Date().toISOString().split("T")[0],
      amountCents,
      method: gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
      reference: result.providerRef,
      bankAccountId: mpesaBank?.id,
    });

    return { success: true };
  } catch (err: any) {
    if (isNextRedirect(err)) throw err;
    return { error: err.message || "Failed to process payout" };
  }
}
