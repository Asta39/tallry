import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { db, documents, payments, contacts } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { getClientSession } from "@/lib/client-portal/auth";
import { StatementPdf } from "@/lib/pdf/StatementPdf";
import { todayISO } from "@/lib/money";
import { addDays } from "@/lib/recurring";
import type { StatementLine } from "@/lib/phase-a-actions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgSlug: string; contactId: string }> }
) {
  const { orgSlug, contactId } = await ctx.params;
  const session = await getClientSession(orgSlug);
  if (!session) {
    return new Response("Sign in required", { status: 401 });
  }

  const cid = Number(contactId);
  // Verify they can only access their own statement
  if (session.contactId !== cid) {
    return new Response("Unauthorized", { status: 403 });
  }

  const o = session.org;

  const to = req.nextUrl.searchParams.get("to") || todayISO();
  const from = req.nextUrl.searchParams.get("from") || addDays(to, -90);

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.orgId, session.orgId), eq(contacts.id, cid)))
    .limit(1);

  if (!contact) return new Response("Contact not found", { status: 404 });

  const docs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.orgId, session.orgId),
        eq(documents.contactId, cid),
        inArray(documents.type, ["invoice", "credit_note"]),
        inArray(documents.status, ["open", "partial", "paid", "written_off"])
      )
    );

  const pays = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.orgId, session.orgId), eq(payments.contactId, cid), eq(payments.direction, "in"))
    );

  type Ev = { date: string; ref: string; description: string; d: number; c: number };
  const events: Ev[] = [
    ...docs
      .filter((x) => x.type === "invoice")
      .map((x) => ({ date: x.date, ref: x.number, description: "Invoice", d: x.totalCents, c: 0 })),
    ...docs
      .filter((x) => x.type === "credit_note")
      .map((x) => ({ date: x.date, ref: x.number, description: "Credit note", d: 0, c: x.totalCents })),
    ...pays.map((p) => ({
      date: p.date,
      ref: p.number,
      description: `Payment (${p.method})${p.whtCents ? " incl. WHT" : ""}`,
      d: 0,
      c: p.amountCents,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));

  let opening = 0;
  const inRange: StatementLine[] = [];
  let running = 0;
  for (const e of events) {
    if (e.date < from) {
      opening += e.d - e.c;
      running = opening;
    } else if (e.date <= to) {
      running += e.d - e.c;
      inRange.push({
        date: e.date,
        ref: e.ref,
        description: e.description,
        debitCents: e.d,
        creditCents: e.c,
        balanceCents: running,
      });
    }
  }

  const data = {
    org: o,
    contact,
    from,
    to,
    openingBalanceCents: opening,
    lines: inRange,
    closingBalanceCents: running,
  };

  const element = React.createElement(StatementPdf, data as any);

  const pdfBuffer = await renderToBuffer(
    element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>
  );

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const filename = `Statement_${contact.displayName.replace(/[^a-z0-9]/gi, "_")}_${todayISO()}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
