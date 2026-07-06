import Link from "next/link";
import { db, documents, contacts } from "@/db";
import { and, desc, eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, PrimaryLink, StatusPill, TableCard, Th, Td, EmptyState } from "@/components/ui";

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
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Number</Th>
              <Th>{type === "bill" || type === "expense" || type === "purchase_order" ? "Vendor" : "Customer"}</Th>
              <Th>Status</Th>
              <Th right>Total</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ doc: d, contactName }) => (
              <tr key={d.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                <Td>
                  <Link href={`${basePath}/${d.id}`} className="font-medium hover:text-[var(--color-accent-600)]">
                    {d.number}
                  </Link>
                </Td>
                <Td>{contactName ?? "—"}</Td>
                <Td>
                  <StatusPill
                    status={d.status}
                    overdue={d.status === "open" && !!d.dueDate && d.dueDate < today}
                  />
                </Td>
                <Td right>{fmtKES(d.totalCents)}</Td>
                <Td right className="font-medium">
                  {["open", "partial"].includes(d.status) ? fmtKES(d.totalCents - d.paidCents) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
