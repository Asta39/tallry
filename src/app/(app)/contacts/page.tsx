import Link from "next/link";
import { db, contacts, documents } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const rows = await db.select().from(contacts).where(eq(contacts.archived, false));
  const openDocs = await db
    .select()
    .from(documents)
    .where(and(inArray(documents.status, ["open", "partial"]), inArray(documents.type, ["invoice", "bill"])));

  const balances = new Map<number, { owedToYou: number; youOwe: number }>();
  for (const d of openDocs) {
    if (!d.contactId) continue;
    const b = balances.get(d.contactId) ?? { owedToYou: 0, youOwe: 0 };
    const bal = d.totalCents - d.paidCents;
    if (d.type === "invoice") b.owedToYou += bal;
    else b.youOwe += bal;
    balances.set(d.contactId, b);
  }

  return (
    <>
      <PageHeader
        title="Customers & Vendors"
        subtitle="Everyone you do business with, in one place"
        action={<PrimaryLink href="/contacts/new">+ New contact</PrimaryLink>}
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add your customers and suppliers. Capture their KRA PIN so your invoices support their input-VAT claims."
          action={<PrimaryLink href="/contacts/new">+ New contact</PrimaryLink>}
        />
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Phone</Th>
              <Th>KRA PIN</Th>
              <Th right>Owes you</Th>
              <Th right>You owe</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const b = balances.get(c.id);
              return (
                <tr key={c.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                  <Td>
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:text-[var(--color-accent-600)]">
                      {c.displayName}
                    </Link>
                    {c.city && <span className="text-[var(--color-ink-400)]"> · {c.city}</span>}
                  </Td>
                  <Td className="capitalize text-[var(--color-ink-600)]">{c.kind}</Td>
                  <Td>{c.phone ?? "—"}</Td>
                  <Td className="tnum">{c.kraPin ?? "—"}</Td>
                  <Td right>{b?.owedToYou ? fmtKES(b.owedToYou) : "—"}</Td>
                  <Td right>{b?.youOwe ? fmtKES(b.youOwe) : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
