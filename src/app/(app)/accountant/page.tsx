import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { db, accounts, bankAccounts, items } from "@/db";
import { accountBalances } from "@/lib/reports";
import { PageHeader, PrimaryLink } from "@/components/ui";
import { ChartOfAccountsClient } from "./ChartOfAccountsClient";
import { ExpenseClaimAccountBanner } from "./ExpenseClaimAccountBanner";
import { previewExpenseClaimAccountDrift } from "@/lib/expense-claims";

export const dynamic = "force-dynamic";

export default async function AccountantPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const all = await db.select().from(accounts).where(eq(accounts.orgId, o.id));
  const [bankLinked, itemLinked] = await Promise.all([
    db.select({ accountId: bankAccounts.accountId }).from(bankAccounts).where(eq(bankAccounts.orgId, o.id)),
    db
      .select({ salesAccountId: items.salesAccountId, purchaseAccountId: items.purchaseAccountId })
      .from(items)
      .where(eq(items.orgId, o.id)),
  ]);
  const balances = await withOrg(() => accountBalances({}));
  const balMap: Record<number, number> = Object.fromEntries(balances.map((b) => [b.accountId, b.balanceCents]));
  const autoManagedIds = new Set<number>();
  for (const row of bankLinked) autoManagedIds.add(row.accountId);
  for (const row of itemLinked) {
    if (row.salesAccountId) autoManagedIds.add(row.salesAccountId);
    if (row.purchaseAccountId) autoManagedIds.add(row.purchaseAccountId);
  }
  const balanceAdjustable: Record<number, boolean> = Object.fromEntries(
    all.map((a) => [a.id, !a.isSystem && !autoManagedIds.has(a.id)])
  );
  const claimDrift = await previewExpenseClaimAccountDrift();

  return (
    <>
      <PageHeader
        title="Accountant"
        subtitle="Chart of accounts and the general ledger behind every number"
        action={<PrimaryLink href="/accountant/journals/new">+ Manual journal</PrimaryLink>}
      />
      <ExpenseClaimAccountBanner count={claimDrift.count} totalCents={claimDrift.totalCents} />
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
        <Link href="/accounting/budgets" className="text-[var(--color-accent-600)] font-medium">
          Budgets →
        </Link>
      </div>

      <ChartOfAccountsClient accounts={all} balances={balMap} balanceAdjustable={balanceAdjustable} />
    </>
  );
}
