import Link from "next/link";
import { db, documents, contacts, documentAssignments } from "@/db";
import { and, desc, eq, exists } from "drizzle-orm";
import { getAccessCached, canViewAllData } from "@/lib/access";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, PrimaryLink, EmptyState } from "@/components/ui";
import { DocListClient } from "./DocListClient";

export async function DocList({
  type,
  title,
  subtitle,
  basePath,
  newLabel,
  newHref,
  emptyTitle,
  emptyBody,
  isTemplate = false,
}: {
  type: string;
  title: string;
  subtitle?: string;
  basePath: string;
  newLabel: string;
  newHref?: string;
  emptyTitle: string;
  emptyBody: string;
  isTemplate?: boolean;
}) {
  const today = todayISO();
  const access = await getAccessCached();
  if (!access) return null;
  const orgId = access.orgId;
  const viewAll = canViewAllData(access);

  const rows = await db
    .select({
      doc: documents,
      contactName: contacts.displayName,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, type),
        eq(documents.isTemplate, isTemplate),
        viewAll
          ? undefined
          : exists(
              db
                .select()
                .from(documentAssignments)
                .where(
                  and(
                    eq(documentAssignments.documentId, documents.id),
                    eq(documentAssignments.memberId, access.memberId!)
                  )
                )
            )
      )
    )
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
        action={<PrimaryLink href={newHref || `${basePath}/new`}>{newLabel}</PrimaryLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          action={<PrimaryLink href={newHref || `${basePath}/new`}>{newLabel}</PrimaryLink>}
        />
      ) : (
        <DocListClient type={type} rows={serializedRows} basePath={basePath} isTemplate={isTemplate} />
      )}
    </>
  );
}
