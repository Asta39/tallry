"use server";

import { requirePerm } from "@/lib/guard";
import { getGateway } from "@/lib/payments/gateway";
import { db, documents, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";

export async function requestPaymentAction(documentId: number, phone: string, amountCents: number) {
  await requirePerm("invoices");
  const o = await getOrg();

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
  if (!doc) throw new Error("Document not found");
  if (doc.type !== "invoice") throw new Error("Can only request payment for invoices");
  
  const [gwConfig] = await db.select().from(paymentGateways).where(and(eq(paymentGateways.orgId, o.id), eq(paymentGateways.enabled, true)));
  if (!gwConfig) throw new Error("No payment gateway connected");

  const gateway = await getGateway(gwConfig);
  
  await gateway.requestPayment({
    phone,
    amountCents,
    accountRef: doc.number,
    description: `Payment for Invoice ${doc.number}`
  });
}

export async function payOutAction(documentId: number, destination: string, destinationType: "phone" | "till" | "paybill", amountCents: number) {
  await requirePerm("can_payout"); // Will add this permission in Phase 4 tasks
  const o = await getOrg();

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.orgId, o.id)));
  if (!doc) throw new Error("Document not found");
  if (doc.type !== "bill" && doc.type !== "expense") throw new Error("Can only payout for bills or expenses");

  const [gwConfig] = await db.select().from(paymentGateways).where(and(eq(paymentGateways.orgId, o.id), eq(paymentGateways.enabled, true)));
  if (!gwConfig) throw new Error("No payment gateway connected");

  const gateway = await getGateway(gwConfig);
  
  await gateway.payOut({
    destination,
    destinationType,
    amountCents,
    accountRef: doc.number,
    reason: `Payout for ${doc.type} ${doc.number}`
  });
}
