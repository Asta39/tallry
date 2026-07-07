import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import React from "react";
import { db, documents, documentLines, contacts } from "@/db";
import { and, eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";

export const dynamic = "force-dynamic";

/**
 * Branded PDF for a document.
 *   GET /api/pdf/123            → inline (view in browser tab)
 *   GET /api/pdf/123?download=1 → attachment (direct download)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let o;
  try {
    o = await getOrg();
  } catch {
    return new Response("Sign in required", { status: 401 });
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, o.id), eq(documents.id, Number(id))))
    .limit(1);
  if (!doc) return new Response("Not found", { status: 404 });
  if (!["invoice", "quote", "credit_note", "expense", "bill", "purchase_order"].includes(doc.type)) {
    return new Response("PDF not supported for this document type", { status: 400 });
  }

  const lines = await db
    .select()
    .from(documentLines)
    .where(and(eq(documentLines.orgId, o.id), eq(documentLines.documentId, doc.id)));
  const contact = doc.contactId
    ? (
        await db
          .select()
          .from(contacts)
          .where(and(eq(contacts.orgId, o.id), eq(contacts.id, doc.contactId)))
          .limit(1)
      )[0]
    : null;

  const qrDataUrl = doc.qrUrl ? await QRCode.toDataURL(doc.qrUrl, { margin: 1, width: 240 }) : null;

  const element = React.createElement(DocumentPdf, {
      org: {
        name: o.name,
        kraPin: o.kraPin,
        address: o.address,
        phone: o.phone,
        email: o.email,
        logoUrl: o.logoUrl,
        brandColor: o.brandColor ?? "#0f766e",
        documentFooterText: o.documentFooterText,
        customDocumentColumnName: o.customDocumentColumnName,
        invoiceTemplate: o.invoiceTemplate,
        quoteTemplate: o.quoteTemplate,
      },
      doc: {
        type: doc.type,
        number: doc.number,
        date: doc.date,
        dueDate: doc.dueDate,
        status: doc.status,
        notes: doc.notes,
        subtotalCents: doc.subtotalCents,
        taxCents: doc.taxCents,
        totalCents: doc.totalCents,
        paidCents: doc.paidCents,
        cuInvoiceNumber: doc.cuInvoiceNumber,
        cuSerial: doc.cuSerial,
      },
      contact,
      lines: lines.map((l) => ({
        description: l.description,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        taxClass: l.taxClass,
        taxRateBp: l.taxRateBp,
        netCents: l.netCents,
        taxCents: l.taxCents,
        grossCents: l.grossCents,
        customColumnValue: l.customColumnValue,
      })),
      qrDataUrl,
    });
  // DocumentPdf returns a react-pdf <Document>; renderToBuffer's prop typing
  // only accepts the intrinsic Document element, so cast through the wrapper.
  const buffer = await renderToBuffer(element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>);

  const download = req.nextUrl.searchParams.get("download") === "1";
  const filename = `${doc.number.replace(/[^\w.-]+/g, "_")}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
