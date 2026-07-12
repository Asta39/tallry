import { NextRequest, NextResponse } from "next/server";
import { getReceiptByToken, receiptUrl } from "@/lib/receipts/tokens";
import { qrPngDataUrl } from "@/lib/receipts/qr";
import { PaymentReceiptPdf } from "@/lib/pdf/PaymentReceiptPdf";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const receipt = await getReceiptByToken(token);
  if (!receipt) return new NextResponse("Receipt not found", { status: 404 });

  const { org, payment, doc, contact } = receipt;
  const url = receiptUrl(token);
  const qrDataUrl = await qrPngDataUrl(url).catch(() => undefined);

  const element = React.createElement(PaymentReceiptPdf, {
    qrDataUrl,
    receiptUrl: url,
    org,
    contact: {
      displayName: contact?.displayName ?? "Customer",
      address: contact?.address ?? null,
      city: contact?.city ?? null,
      kraPin: contact?.kraPin ?? null,
    },
    payment: {
      id: payment.id,
      date: payment.date,
      reference: payment.reference,
      method: payment.method,
      amountCents: payment.amountCents,
      invoiceNumber: doc?.number ?? "",
    },
  });

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `Receipt_${payment.number}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
