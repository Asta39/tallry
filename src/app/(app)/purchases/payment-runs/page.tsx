import { requirePerm } from "@/lib/guard";
import { listPaymentRuns } from "@/lib/payment-runs";
import { PageHeader, PrimaryLink, StatusPill } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentRunsPage() {
  await requirePerm("accountant");
  const runs = await listPaymentRuns();

  return (
    <>
      <PageHeader
        title="Vendor Payment Runs"
        subtitle="Batch-select open bills and pay them together in one run"
        action={<PrimaryLink href="/purchases/payment-runs/new">+ New payment run</PrimaryLink>}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Date</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Total</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="hairline-t">
                <td className="px-4 py-2.5 text-[13px] tnum">{r.date}</td>
                <td className="px-3 py-2.5"><StatusPill status={r.status === "posted" ? "paid" : "draft"} /></td>
                <td className="px-3 py-2.5 text-[13px] text-right tnum font-medium">{fmtKES(r.totalCents)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/purchases/payment-runs/${r.id}`} className="text-[12.5px] font-medium text-[var(--color-accent-600)] hover:underline">
                    {r.status === "draft" ? "Review & post →" : "View →"}
                  </Link>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No payment runs yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
