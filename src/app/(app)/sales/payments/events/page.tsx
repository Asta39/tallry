import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, paymentEvents, documents, contacts } from "@/db";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { EventsTable, type EventRow, type OpenInvoice } from "./EventsTable";

export const dynamic = "force-dynamic";

export default async function GatewayEventsPage() {
  await requirePerm("invoices");
  const o = await getOrg();

  const events = await db.select().from(paymentEvents)
    .where(and(
      eq(paymentEvents.orgId, o.id),
      eq(paymentEvents.direction, "in"),
      inArray(paymentEvents.status, ["unmatched", "amount_mismatch", "received", "failed"]),
    ))
    .orderBy(desc(paymentEvents.id))
    .limit(200);

  const openInvoices = await db.select({
    id: documents.id,
    number: documents.number,
    totalCents: documents.totalCents,
    paidCents: documents.paidCents,
    contactName: contacts.displayName,
    contactPhone: contacts.phone,
  })
    .from(documents)
    .leftJoin(contacts, eq(contacts.id, documents.contactId))
    .where(and(
      eq(documents.orgId, o.id),
      eq(documents.type, "invoice"),
      sql`${documents.totalCents} - ${documents.paidCents} > 0`,
      sql`${documents.status} IN ('open', 'partial', 'overdue', 'sent')`,
    ))
    .orderBy(desc(documents.id))
    .limit(300);

  const rows: EventRow[] = events.map(e => ({
    id: e.id,
    date: e.createdAt.slice(0, 10),
    gatewayId: e.gatewayId,
    providerRef: e.providerRef,
    amountCents: e.amountCents,
    payerPhone: e.payerPhone,
    payerName: e.payerName,
    accountRef: e.accountRef,
    status: e.status,
  }));

  const invoices: OpenInvoice[] = openInvoices.map(i => ({
    id: i.id,
    number: i.number,
    outstandingCents: i.totalCents - i.paidCents,
    contactName: i.contactName,
    contactPhone: i.contactPhone,
  }));

  return (
    <>
      <PageHeader
        title="Gateway Events"
        subtitle="Payments that arrived via M-Pesa / Kopo Kopo but could not be matched to an invoice automatically"
      />
      <EventsTable events={rows} invoices={invoices} />
    </>
  );
}
