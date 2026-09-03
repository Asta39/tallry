import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import Link from "next/link";
import { db, contacts, documents } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, PrimaryLink, TableCard, Th, Td, EmptyState } from "@/components/ui";
import { CsvImporter } from "@/components/CsvImporter";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ followup?: string }> }) {
  await requirePerm("contacts");
  const access = await getAccess();
  const showFinancials = !access || access.perms.has("financials");
  const { followup } = await searchParams;
  const followUpOnly = followup === "due";
  const today = todayISO();
  const o = await getOrg();
  let rows = await db.select().from(contacts).where(and(eq(contacts.orgId, o.id), eq(contacts.archived, false)));
  const dueCount = rows.filter((c) => c.nextFollowUpAt && c.nextFollowUpAt <= today).length;
  if (followUpOnly) {
    rows = rows
      .filter((c) => c.nextFollowUpAt && c.nextFollowUpAt <= today)
      .sort((a, b) => (a.nextFollowUpAt! < b.nextFollowUpAt! ? -1 : 1));
  }
  const openDocs = showFinancials
    ? await db
        .select()
        .from(documents)
        .where(and(eq(documents.orgId, o.id), inArray(documents.status, ["open", "partial"]), inArray(documents.type, ["invoice", "bill"])))
    : [];

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
        action={
          <div className="flex items-start gap-2">
            <Link
              href={followUpOnly ? "/contacts" : "/contacts?followup=due"}
              className={`rounded-lg border text-[13px] font-medium px-4 py-2 h-9 inline-flex items-center ${
                followUpOnly
                  ? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)]/10 text-[var(--color-accent-700)]"
                  : "border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)]"
              }`}
            >
              {followUpOnly ? "Showing follow-ups due ✕" : `Follow up due${dueCount > 0 ? ` (${dueCount})` : ""}`}
            </Link>
            <Link
              href="/contacts/groups"
              className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2 h-9 inline-flex items-center"
            >
              Groups
            </Link>
            <CsvImporter entity="contacts" label="Bulk import contacts" />
            <PrimaryLink href="/contacts/new">+ New contact</PrimaryLink>
          </div>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          body="Add your customers and suppliers. Capture their KRA PIN so your invoices support their input-VAT claims."
          action={
          <div className="flex items-start gap-2">
            <Link
              href="/contacts/groups"
              className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2 h-9 inline-flex items-center"
            >
              Groups
            </Link>
            <CsvImporter entity="contacts" label="Bulk import contacts" />
            <PrimaryLink href="/contacts/new">+ New contact</PrimaryLink>
          </div>
        }
        />
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Phone</Th>
              <Th>KRA PIN</Th>
              <Th>Follow up</Th>
              {showFinancials && <Th right>Owes you</Th>}
              {showFinancials && <Th right>You owe</Th>}
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
                  <Td className={c.nextFollowUpAt && c.nextFollowUpAt <= today ? "text-[var(--color-bad)] font-medium" : "text-[var(--color-ink-500)]"}>
                    {c.nextFollowUpAt ?? "—"}
                  </Td>
                  {showFinancials && <Td right>{b?.owedToYou ? fmtKES(b.owedToYou) : "—"}</Td>}
                  {showFinancials && <Td right>{b?.youOwe ? fmtKES(b.youOwe) : "—"}</Td>}
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
