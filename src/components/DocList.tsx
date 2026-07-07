import Link from "next/link";
import { db, documents, contacts, documentAssignments } from "@/db";
import { and, desc, eq, exists, or, ilike, sql } from "drizzle-orm";
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
  searchParams,
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
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const today = todayISO();
  const access = await getAccessCached();
  if (!access) return null;
  const orgId = access.orgId;
  const viewAll = canViewAllData(access);

  const baseWhere = and(
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
  );

  // 1. Calculate stats across ALL documents of this type (ignoring search filters)
  const statsRaw = await db
    .select({
      status: documents.status,
      overdue: sql<boolean>`${documents.status} = 'open' AND ${documents.dueDate} < ${today}`,
      total: sql<number>`sum(${documents.totalCents})`.mapWith(Number),
      paid: sql<number>`sum(${documents.paidCents})`.mapWith(Number),
    })
    .from(documents)
    .where(baseWhere)
    .groupBy(documents.status, documents.dueDate);

  const stats = { draft: 0, pending: 0, partial: 0, overdue: 0, paid: 0 };
  let outstandingTotal = 0;

  for (const r of statsRaw) {
    const amt = r.total;
    if (r.status === "draft") stats.draft += amt;
    if (r.status === "open") {
      stats.pending += amt;
      outstandingTotal += (amt - r.paid);
      if (r.overdue) stats.overdue += amt;
    }
    if (r.status === "partial") {
      stats.partial += amt;
      outstandingTotal += (amt - r.paid);
    }
    if (r.status === "paid") stats.paid += amt;
  }

  // 2. Parse search parameters
  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const statusFilter = typeof searchParams?.status === "string" ? searchParams.status : "all";
  const page = typeof searchParams?.page === "string" ? parseInt(searchParams.page, 10) || 1 : 1;
  const pageSize = 50;

  // 3. Build filter for paginated list
  const filterWhere = and(
    baseWhere,
    q
      ? or(ilike(documents.number, `%${q}%`), ilike(contacts.displayName, `%${q}%`))
      : undefined,
    statusFilter !== "all"
      ? statusFilter === "overdue"
        ? and(eq(documents.status, "open"), sql`${documents.dueDate} < ${today}`)
        : eq(documents.status, statusFilter)
      : undefined
  );

  // 4. Count total matching rows
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(filterWhere);

  // 5. Fetch paginated rows
  const rows = await db
    .select({
      doc: documents,
      contactName: contacts.displayName,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(filterWhere)
    .orderBy(desc(documents.date), desc(documents.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  // Next.js requires plain objects to be passed to Client Components.
  const serializedRows = JSON.parse(JSON.stringify(rows));

  // Determine empty state based on TOTAL count, not filtered count
  const [{ totalDbCount }] = await db
    .select({ totalDbCount: sql<number>`count(*)`.mapWith(Number) })
    .from(documents)
    .where(baseWhere);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle ?? (outstandingTotal > 0 ? `${fmtKES(outstandingTotal)} outstanding` : undefined)}
        action={<PrimaryLink href={newHref || `${basePath}/new`}>{newLabel}</PrimaryLink>}
      />
      {totalDbCount === 0 ? (
        <EmptyState
          title={emptyTitle}
          body={emptyBody}
          action={<PrimaryLink href={newHref || `${basePath}/new`}>{newLabel}</PrimaryLink>}
        />
      ) : (
        <DocListClient
          type={type}
          rows={serializedRows}
          stats={stats}
          totalCount={count}
          basePath={basePath}
          isTemplate={isTemplate}
          currentPage={page}
        />
      )}
    </>
  );
}
