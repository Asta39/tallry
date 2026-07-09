import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { db, accounts } from "@/db";
import { fmtKES } from "@/lib/money";
import { accountBalances } from "@/lib/reports";
import { PageHeader, PrimaryLink, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

const typeLabels: Record<string, string> = {
  asset: "Assets — what you own",
  liability: "Liabilities — what you owe",
  equity: "Equity — the owner's stake",
  income: "Income",
  expense: "Expenses",
};

export default async function AccountantPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const all = await db.select().from(accounts).where(eq(accounts.orgId, o.id));
  const balances = await withOrg(() => accountBalances({}));
  const balMap = new Map(balances.map((b) => [b.accountId, b.balanceCents]));

  return (
    <>
      <PageHeader
        title="Accountant"
        subtitle="Chart of accounts and the general ledger behind every number"
        action={<PrimaryLink href="/accountant/journals/new">+ Manual journal</PrimaryLink>}
      />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
        <Link href="/accountant/journals" className="text-[var(--color-accent-600)] font-medium">
          View journal entries →
        </Link>
        <Link href="/reports/trial-balance" className="text-[var(--color-accent-600)] font-medium">
          Trial balance →
        </Link>
        <Link href="/accounting/period-lock" className="text-[var(--color-accent-600)] font-medium">
          Lock books →
        </Link>
        <Link href="/accounting/drawings" className="text-[var(--color-accent-600)] font-medium">
          Owner&apos;s drawings →
        </Link>
        <Link href="/recurring" className="text-[var(--color-accent-600)] font-medium">
          Recurring templates →
        </Link>
      </div>

      {(["asset", "liability", "equity", "income", "expense"] as const).map((type) => (
        <div key={type} className="mb-6">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-2">{typeLabels[type]}</h2>
          <TableCard>
            <thead className="hairline-b">
              <tr><Th>Code</Th><Th>Account</Th><Th right>Balance</Th></tr>
            </thead>
            <tbody>
              {all
                .filter((a) => a.type === type)
                .map((a) => (
                  <tr key={a.id} className="hairline-t">
                    <Td className="tnum text-[var(--color-ink-400)]">{a.code}</Td>
                    <Td>
                      <Link href={`/accountant/ledger/${a.id}`} className="font-medium hover:text-[var(--color-accent-600)]">
                        {a.name}
                      </Link>
                      {a.isSystem && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-ink-400)]">system</span>
                      )}
                    </Td>
                    <Td right>{fmtKES(balMap.get(a.id) ?? 0)}</Td>
                  </tr>
                ))}
            </tbody>
          </TableCard>
        </div>
      ))}
    </>
  );
}
