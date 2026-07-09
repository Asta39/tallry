import { NextRequest, NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";
import { getStatementData } from "@/lib/phase-a-actions";
import { StatementPdf } from "@/lib/pdf/StatementPdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { todayISO } from "@/lib/money";
import { addDays } from "@/lib/recurring";
import React from "react";

export async function GET(req: NextRequest, props: { params: Promise<{ contactId: string }> }) {
  await requirePerm("contacts");
  const { contactId } = await props.params;
  const cid = Number(contactId);

  const to = req.nextUrl.searchParams.get("to") || todayISO();
  const from = req.nextUrl.searchParams.get("from") || addDays(to, -90);

  const data = await getStatementData(cid, from, to);

  const element = React.createElement(StatementPdf, data);

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `Statement_${data.contact.name.replace(/[^a-z0-9]/gi, "_")}_${todayISO()}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
