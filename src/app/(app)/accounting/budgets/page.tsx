import { requirePerm } from "@/lib/guard";
import { listBudgets } from "@/lib/budgets";
import { PageHeader, PrimaryLink } from "@/components/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  await requirePerm("accountant");
  const budgets = await listBudgets();

  return (
    <>
      <PageHeader
        title="Budgets"
        subtitle="Set monthly targets per account and track actuals against them"
        action={<PrimaryLink href="/accounting/budgets/new">+ New budget</PrimaryLink>}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Name</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Fiscal year</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => (
              <tr key={b.id} className="hairline-t">
                <td className="px-4 py-2.5 text-[13px] font-medium">{b.name}</td>
                <td className="px-3 py-2.5 text-[13px] tnum">{b.fiscalYear}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/accounting/budgets/${b.id}`} className="text-[12.5px] font-medium text-[var(--color-accent-600)] hover:underline">Open →</Link>
                </td>
              </tr>
            ))}
            {budgets.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No budgets yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
