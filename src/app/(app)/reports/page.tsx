import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const reports = [
  {
    group: "How the business is doing",
    items: [
      { href: "/reports/pnl", title: "Profit & Loss", body: "Income minus spending — did you make money?" },
      { href: "/reports/balance-sheet", title: "Balance Sheet", body: "What you own vs what you owe, right now." },
      { href: "/reports/aging", title: "Who owes you (Aging)", body: "Unpaid invoices and bills, bucketed by lateness." },
    ],
  },
  {
    group: "KRA & compliance",
    items: [
      { href: "/reports/vat", title: "VAT Return (VAT 3) prep", body: "Output VAT vs input VAT for the period — the numbers you file on iTax." },
      { href: "/reports/trial-balance", title: "Trial Balance", body: "Every account's debits and credits — for your accountant." },
    ],
  },
];

export default async function ReportsPage() {
  await requirePerm("reports");
  return (
    <>
      <PageHeader title="Reports" subtitle="All derived from the ledger, so they always reconcile" />
      {reports.map((g) => (
        <div key={g.group} className="mb-7">
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">{g.group}</h2>
          <div className="grid grid-cols-3 gap-4">
            {g.items.map((r) => (
              <Link key={r.href} href={r.href} className="card px-5 py-4 hover:shadow-md transition-shadow">
                <div className="text-[14px] font-semibold">{r.title}</div>
                <p className="text-[12.5px] text-[var(--color-ink-400)] mt-1">{r.body}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
