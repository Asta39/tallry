import { NextRequest, NextResponse } from "next/server";
import { db, payments, documents, contacts, org } from "@/db";
import { and, eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-portal/auth";
import { PaymentReceiptPdf } from "@/lib/pdf/PaymentReceiptPdf";
import { getOrCreateReceiptToken, receiptUrl } from "@/lib/receipts/tokens";
import { qrPngDataUrl } from "@/lib/receipts/qr";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export async function GET(req: NextRequest, props: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await props.params;
  const paymentId = Number(id);

  const session = await getClientSession(orgSlug);
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const [row] = await db
    .select({
      payment: payments,
      doc: documents,
      contact: contacts,
      o: org,
    })
    .from(payments)
    .where(and(eq(payments.orgId, session.orgId), eq(payments.id, paymentId), eq(payments.contactId, session.contactId)))
    .innerJoin(org, eq(org.id, payments.orgId))
    .leftJoin(documents, eq(documents.id, payments.documentId))
    .innerJoin(contacts, eq(contacts.id, payments.contactId))
    .limit(1);

  if (!row) {
    return new NextResponse("Payment not found", { status: 404 });
  }

  const token = await getOrCreateReceiptToken(session.orgId, paymentId).catch(() => null);
  const url = token ? await receiptUrl(token) : undefined;
  const qrDataUrl = url ? await qrPngDataUrl(url).catch(() => undefined) : undefined;

  const element = React.createElement(PaymentReceiptPdf, {
    qrDataUrl,
    receiptUrl: url,
    org: row.o as any,
    contact: {
      displayName: row.contact.displayName,
      address: row.contact.address,
      city: row.contact.city,
      kraPin: row.contact.kraPin,
    },
    payment: {
      id: row.payment.id,
      date: row.payment.date,
      reference: row.payment.reference,
      method: row.payment.method,
      amountCents: row.payment.amountCents,
      invoiceNumber: row.doc?.number || "",
    },
  });

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `Payment_Receipt_PAY-${row.payment.id.toString().padStart(4, "0")}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
