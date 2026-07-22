import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { db, accounts } from "@/db";
import { accountBalances } from "@/lib/reports";
import { PageHeader, PrimaryLink } from "@/components/ui";
import { ChartOfAccountsClient } from "./ChartOfAccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountantPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const all = await db.select().from(accounts).where(eq(accounts.orgId, o.id));
  const balances = await withOrg(() => accountBalances({}));
  const balMap: Record<number, number> = Object.fromEntries(balances.map((b) => [b.accountId, b.balanceCents]));

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
        <Link href="/accountant/cost-centers" className="text-[var(--color-accent-600)] font-medium">
          Cost centers →
        </Link>
      </div>

      <ChartOfAccountsClient accounts={all} balances={balMap} />
    </>
  );
}
