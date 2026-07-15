import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db, documents, documentLines, contacts } from "@/db";
import { and, eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-portal/auth";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgSlug: string; id: string }> }
) {
  const { orgSlug, id } = await ctx.params;
  const session = await getClientSession(orgSlug);
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }

  const o = session.org;

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.orgId, session.orgId),
        eq(documents.contactId, session.contactId),
        eq(documents.id, Number(id))
      )
    )
    .limit(1);

  if (!doc) return new Response("Not found", { status: 404 });
  if (!["invoice", "quote", "credit_note"].includes(doc.type)) {
    return new Response("PDF not supported for this document type", { status: 400 });
  }

  const lines = await db
    .select()
    .from(documentLines)
    .where(and(eq(documentLines.orgId, o.id), eq(documentLines.documentId, doc.id)));

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, o.id), eq(contacts.id, session.contactId)))
    .limit(1);

  const element = React.createElement(DocumentPdf, {
    doc: doc as any,
    lines: lines as any,
    contact: contact as any,
    org: o as any,
    qrCodeDataUrl: undefined,
  });

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `${doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}_${doc.number}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
