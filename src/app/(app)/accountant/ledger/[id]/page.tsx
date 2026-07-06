import { withOrg } from "@/lib/org";
import { getOrg } from "@/lib/org";
import { notFound } from "next/navigation";
import { db, accounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { generalLedger } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const o = await getOrg();
  const { id } = await params;
  const [account] = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.id, Number(id)))).limit(1);
  if (!account) notFound();
  const rows = await withOrg(() => generalLedger(account.id));

  let running = 0;
  const debitNature = account.type === "asset" || account.type === "expense";

  return (
    <>
      <PageHeader title={`${account.code} · ${account.name}`} subtitle="General ledger" />
      <TableCard>
        <thead className="hairline-b">
          <tr><Th>Date</Th><Th>Memo</Th><Th>Source</Th><Th right>Debit</Th><Th right>Credit</Th><Th right>Balance</Th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            running += debitNature ? r.debitCents - r.creditCents : r.creditCents - r.debitCents;
            return (
              <tr key={i} className="hairline-t">
                <Td className="text-[var(--color-ink-400)]">{r.date}</Td>
                <Td>{r.memo ?? r.lineMemo ?? "—"}</Td>
                <Td className="text-[var(--color-ink-400)]">{r.sourceType}</Td>
                <Td right>{r.debitCents ? fmtKES(r.debitCents) : ""}</Td>
                <Td right>{r.creditCents ? fmtKES(r.creditCents) : ""}</Td>
                <Td right className="font-medium">{fmtKES(running)}</Td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td className="text-center text-[13px] text-[var(--color-ink-400)] py-8" colSpan={6}>No entries in this account yet.</td></tr>
          )}
        </tbody>
      </TableCard>
    </>
  );
}
