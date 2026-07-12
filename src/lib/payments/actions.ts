"use server";

import { requirePerm } from "@/lib/guard";
import { getGateway } from "@/lib/payments/gateway";
import { db, documents, paymentGateways, paymentEvents } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";

export async function requestPaymentAction(documentId: number, phone: string, amountCents: number, gatewayId: string) {
  try {
    await requirePerm("invoices");
    const o = await getOrg();

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
    if (!doc) return { error: "Document not found" };
    if (doc.type !== "invoice") return { error: "Can only request payment for invoices" };
    
    const [gwConfig] = await db.select().from(paymentGateways).where(and(
      eq(paymentGateways.orgId, o.id), 
      eq(paymentGateways.enabled, true),
      eq(paymentGateways.gatewayId, gatewayId)
    ));
    if (!gwConfig) return { error: "Selected payment gateway is not connected or enabled" };

    const gateway = await getGateway(gwConfig);
    
    const result = await gateway.requestPayment({
      phone,
      amountCents,
      accountRef: doc.number,
      description: `Payment for Invoice ${doc.number}`
    });

    // Save a pending payment event linked to this specific invoice.
    // When the webhook callback arrives, it will look up this pending event
    // by providerRef (CheckoutRequestID for Daraja, Location for KopoKopo)
    // and immediately know which invoice to apply the payment to.
    await db.insert(paymentEvents).values({
      orgId: o.id,
      gatewayId,
      providerRef: result.providerRef, // CheckoutRequestID (Daraja) or Location URL (KopoKopo)
      amountCents,
      payerPhone: phone,
      accountRef: doc.number,
      status: "pending",
      matchedDocumentId: documentId,
      rawJson: JSON.stringify({ stkPushRef: result.providerRef, phone, amountCents }),
      createdAt: new Date().toISOString(),
    });
    
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to request payment" };
  }
}

export async function payOutAction(documentId: number, destination: string, destinationType: "phone" | "till" | "paybill", amountCents: number, gatewayId: string) {
  try {
    await requirePerm("can_payout"); // Will add this permission in Phase 4 tasks
    const o = await getOrg();

    const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
    if (!doc) return { error: "Document not found" };
    if (doc.type !== "bill" && doc.type !== "expense") return { error: "Can only payout for bills or expenses" };

    const [gwConfig] = await db.select().from(paymentGateways).where(and(
      eq(paymentGateways.orgId, o.id), 
      eq(paymentGateways.enabled, true),
      eq(paymentGateways.gatewayId, gatewayId)
    ));
    if (!gwConfig) return { error: "Selected payment gateway is not connected or enabled" };

    const gateway = await getGateway(gwConfig);
    
    await gateway.payOut({
      destination,
      destinationType,
      amountCents,
      accountRef: doc.number,
      reason: `Payout for ${doc.type} ${doc.number}`
    });

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to process payout" };
  }
}

