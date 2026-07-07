import Link from "next/link";
import { db, documents, contacts } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, PrimaryLink, EmptyState } from "@/components/ui";
import { DocListClient } from "./DocListClient";

export async function DocList({
  type,
  title,
  subtitle,
  basePath,
  newLabel,
  emptyTitle,
  emptyBody,
}: {
  type: string;
  title: string;
  subtitle?: string;
  basePath: string;
  newLabel: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  const today = todayISO();
  const orgId = (await getOrg()).id;
  const rows = await db
    .select({
      doc: documents,
      contactName: contacts.displayName,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(eq(documents.orgId, orgId), eq(documents.type, type)))
    .orderBy(desc(documents.date), desc(documents.id));

  const outstanding = rows
    .filter((r) => ["open", "partial"].includes(r.doc.status))
    .reduce((s, r) => s + r.doc.totalCents - r.doc.paidCents, 0);

  // Next.js requires plain objects to be passed to Client Components.
  // Drizzle sometimes returns objects with null prototypes.
  const serializedRows = JSON.parse(JSON.stringify(rows));

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? (outstanding > 0 ? `${fmtKES(outstanding)} outstanding` : undefined)}
        action={<PrimaryLink href={`${basePath}/new`}>{newLabel}</PrimaryLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          action={<PrimaryLink href={`${basePath}/new`}>{newLabel}</PrimaryLink>}
        />
      ) : (
        <DocListClient type={type} rows={serializedRows} basePath={basePath} />
      )}
    </>
  );
}
