import { requirePerm } from "@/lib/guard";
import { getPaymentRun } from "@/lib/payment-runs";
import { PageHeader, StatusPill } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { notFound } from "next/navigation";
import { PaymentRunActions } from "./PaymentRunActions";

export const dynamic = "force-dynamic";

export default async function PaymentRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("accountant");
  const { id } = await params;
  const data = await getPaymentRun(Number(id));
  if (!data) notFound();
  const { run, items, bankName } = data;

  return (
    <>
      <PageHeader
        title={`Payment Run #${run.id}`}
        subtitle={`${run.date} · Paying from ${bankName}`}
        action={<StatusPill status={run.status === "posted" ? "paid" : "draft"} />}
      />

      <div className="card overflow-hidden mb-4">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Bill</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Vendor</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Amount</th>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="hairline-t">
                <td className="px-4 py-2.5 text-[13px] font-medium">{it.billNumber}</td>
                <td className="px-3 py-2.5 text-[13px]">{it.vendorName || "—"}</td>
                <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(it.amountCents)}</td>
                <td className="px-4 py-2.5 text-right">
                  {it.status === "pending" && <span className="text-[12px] text-[var(--color-ink-400)]">Pending</span>}
                  {it.status === "paid" && <span className="text-[12px] font-medium text-[var(--color-good)]">Paid</span>}
                  {it.status === "failed" && (
                    <span className="text-[12px] font-medium text-[var(--color-bad)]" title={it.failReason || ""}>Failed{it.failReason ? `: ${it.failReason}` : ""}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="hairline-t bg-[var(--color-ink-50)]/60">
              <td colSpan={2} className="px-4 py-2.5 text-[13px] font-semibold">Total</td>
              <td className="px-3 py-2.5 text-[13px] text-right font-semibold tnum">{fmtKES(run.totalCents)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <PaymentRunActions runId={run.id} status={run.status} />
    </>
  );
}
