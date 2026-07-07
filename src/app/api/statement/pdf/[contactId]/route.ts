import { NextRequest, NextResponse } from "next/server";
import { db, contacts, documents, payments } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { StatementPdf } from "@/lib/pdf/StatementPdf";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";

export async function GET(req: NextRequest, props: { params: Promise<{ contactId: string }> }) {
  await requirePerm("contacts");
  const org = await getOrg();
  const { contactId } = await props.params;
  const cid = Number(contactId);

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, org.id), eq(contacts.id, cid)))
    .limit(1);

  if (!contact) {
    return new NextResponse("Contact not found", { status: 404 });
  }

  const allDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, org.id), eq(documents.contactId, cid)))
    .orderBy(desc(documents.date), desc(documents.id));

  const pays = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orgId, org.id), eq(payments.contactId, cid)));

  // Build a chronological ledger
  const ledger: {
    id: string;
    date: string;
    type: "invoice" | "payment";
    description: string;
    amountCents: number;
  }[] = [];

  for (const d of allDocs) {
    if (d.type === "invoice" && !["draft", "void"].includes(d.status)) {
      ledger.push({
        id: `doc-${d.id}`,
        date: d.date,
        type: "invoice",
        description: `Invoice ${d.number}`,
        amountCents: d.totalCents,
      });
    }
  }

  for (const p of pays) {
    ledger.push({
      id: `pay-${p.id}`,
      date: p.date,
      type: "payment",
      description: `Payment ${p.number}`,
      amountCents: -p.amountCents,
    });
  }

  ledger.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.type === b.type) return 0;
    return a.type === "invoice" ? -1 : 1;
  });

  let runningBalance = 0;
  const lines = ledger.map((item) => {
    runningBalance += item.amountCents;
    return { ...item, balance: runningBalance };
  });

  const element = React.createElement(StatementPdf, {
    org,
    contact: {
      displayName: contact.displayName,
      address: contact.address,
      city: contact.city,
      kraPin: contact.kraPin,
    },
    lines,
  });

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `Statement_${contact.displayName.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
