import { NextRequest, NextResponse } from "next/server";
import { db, payments, documents, contacts } from "@/db";
import { and, eq } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { PaymentReceiptPdf } from "@/lib/pdf/PaymentReceiptPdf";
import { getOrCreateReceiptToken, receiptUrl } from "@/lib/receipts/tokens";
import { qrPngDataUrl } from "@/lib/receipts/qr";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices");
  const org = await getOrg();
  const { id } = await props.params;
  const paymentId = Number(id);

  const [row] = await db
    .select({
      payment: payments,
      doc: documents,
      contact: contacts,
    })
    .from(payments)
    .where(and(eq(payments.orgId, org.id), eq(payments.id, paymentId)))
    .innerJoin(documents, eq(documents.id, payments.documentId))
    .innerJoin(contacts, eq(contacts.id, documents.contactId))
    .limit(1);

  if (!row) {
    return new NextResponse("Payment not found", { status: 404 });
  }

  const token = await getOrCreateReceiptToken(org.id, paymentId).catch(() => null);
  const url = token ? receiptUrl(token) : undefined;
  const qrDataUrl = url ? await qrPngDataUrl(url).catch(() => undefined) : undefined;

  const element = React.createElement(PaymentReceiptPdf, {
    qrDataUrl,
    receiptUrl: url,
    org,
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
      invoiceNumber: row.doc.number,
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
