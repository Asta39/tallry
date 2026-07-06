import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { db, journalEntries, journalLines, accounts } from "@/db";
import { desc } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { PageHeader, PrimaryLink, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const o = await getOrg();
  const entries = await db.select().from(journalEntries).where(eq(journalEntries.orgId, o.id)).orderBy(desc(journalEntries.id)).limit(60);
  const lines = await db.select().from(journalLines).where(eq(journalLines.orgId, o.id));
  const accts = await db.select().from(accounts).where(eq(accounts.orgId, o.id));
  const acctName = (id: number) => accts.find((a) => a.id === id)?.name ?? `#${id}`;

  return (
    <>
      <PageHeader
        title="Journal entries"
        subtitle="Every transaction, in double-entry — the source of truth"
        action={<PrimaryLink href="/accountant/journals/new">+ Manual journal</PrimaryLink>}
      />
      <div className="space-y-4">
        {entries.map((e) => {
          const eLines = lines.filter((l) => l.entryId === e.id);
          return (
            <div key={e.id} className="card overflow-hidden">
              <div className="px-4 py-2.5 hairline-b flex items-center gap-3 text-[12.5px]">
                <span className="text-[var(--color-ink-400)] tnum">#{e.id}</span>
                <span className="text-[var(--color-ink-400)]">{e.date}</span>
                <span className="font-medium">{e.memo}</span>
                <span className="ml-auto rounded-full bg-[var(--color-ink-100)] px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-[var(--color-ink-600)]">
                  {e.sourceType}
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th></tr>
                </thead>
                <tbody>
                  {eLines.map((l) => (
                    <tr key={l.id} className="hairline-t">
                      <Td>{acctName(l.accountId)}{l.memo && <span className="text-[var(--color-ink-400)]"> — {l.memo}</span>}</Td>
                      <Td right>{l.debitCents ? fmtKES(l.debitCents) : ""}</Td>
                      <Td right>{l.creditCents ? fmtKES(l.creditCents) : ""}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
            No journal entries yet — issue an invoice or record an expense and watch the double-entry appear here.
          </div>
        )}
      </div>
    </>
  );
}
