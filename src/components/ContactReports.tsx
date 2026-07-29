import Link from "next/link";
import { fmtKES } from "@/lib/money";
import type { CustomerProfitability, VendorSpend } from "@/lib/reports";

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "good" | "bad"; hint?: string }) {
  const color = tone === "good" ? "text-[var(--color-good)]" : tone === "bad" ? "text-[var(--color-bad)]" : "";
  return (
    <div className="card p-4">
      <div className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">{label}</div>
      <div className={`text-[19px] font-semibold mt-1 tnum ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{hint}</div>}
    </div>
  );
}

/** Horizontal share bar — avoids pulling a chart library into a server component. */
function Bar({ label, amountCents, maxCents }: { label: string; amountCents: number; maxCents: number }) {
  const pct = maxCents > 0 ? Math.round((amountCents / maxCents) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <div className="w-40 shrink-0 truncate text-[var(--color-ink-600)]">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-ink-100)] overflow-hidden">
        <div className="h-full rounded-full bg-[var(--color-accent-500)]" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-28 text-right tnum">{fmtKES(amountCents)}</div>
    </div>
  );
}

export function CustomerProfitabilityReport({ data, period }: { data: CustomerProfitability; period: string }) {
  const marginTone = data.grossMarginCents < 0 ? "bad" : data.grossMarginCents > 0 ? "good" : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Net revenue" value={fmtKES(data.netRevenueCents)} hint={data.creditedCents > 0 ? `after ${fmtKES(data.creditedCents)} credited` : undefined} />
        <Stat label="Tagged costs" value={fmtKES(data.taggedCostCents)} />
        <Stat
          label="Gross margin"
          value={fmtKES(data.grossMarginCents)}
          tone={marginTone}
          hint={data.marginPct !== null ? `${(data.marginPct * 100).toFixed(1)}% of revenue` : undefined}
        />
        <Stat
          label="Avg days to pay"
          value={data.avgDaysToPay === null ? "—" : String(data.avgDaysToPay)}
          hint={data.onTimeRate !== null ? `${Math.round(data.onTimeRate * 100)}% paid on time` : "no settled invoices yet"}
        />
      </div>

      {/* Margin is only as good as the tagging — say so rather than implying precision. */}
      {(data.untaggedCostCents > 0 || data.unlinkedCostCents > 0) && (
        <div className="card p-4 border-dashed text-[12.5px] text-[var(--color-ink-600)] space-y-1">
          {data.untaggedCostCents > 0 && (
            <div>
              ⚠︎ {fmtKES(data.untaggedCostCents)} of costs this period aren&apos;t tagged to any customer, so they
              aren&apos;t counted here. Margin shown is an upper bound.
            </div>
          )}
          {data.unlinkedCostCents > 0 && (
            <div>
              {fmtKES(data.unlinkedCostCents)} is tagged to this customer but not linked to a specific invoice — it
              counts in the totals above, but not in the per-invoice breakdown.
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 hairline-b text-[12px] font-semibold text-[var(--color-ink-600)]">
          Margin per invoice · {period}
        </div>
        {data.perInvoice.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
            No invoices in this period.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)] hairline-b">
                <th className="text-left px-4 py-2 font-semibold">Invoice</th>
                <th className="text-left px-2 py-2 font-semibold">Date</th>
                <th className="text-right px-2 py-2 font-semibold">Revenue</th>
                <th className="text-right px-2 py-2 font-semibold">Costs</th>
                <th className="text-right px-4 py-2 font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.perInvoice.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <td className="px-4 py-2">
                    <Link href={`/sales/invoices/${r.id}`} className="font-medium hover:underline">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-[var(--color-ink-500)]">{r.date}</td>
                  <td className="px-2 py-2 text-right tnum">{fmtKES(r.revenueCents)}</td>
                  <td className="px-2 py-2 text-right tnum text-[var(--color-ink-500)]">
                    {r.costCents > 0 ? fmtKES(r.costCents) : "—"}
                  </td>
                  <td className={`px-4 py-2 text-right tnum font-medium ${r.marginCents < 0 ? "text-[var(--color-bad)]" : ""}`}>
                    {fmtKES(r.marginCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function VendorSpendReport({ data, period }: { data: VendorSpend; period: string }) {
  const maxAccount = data.byAccount[0]?.amountCents ?? 0;
  const maxMonth = Math.max(0, ...data.byMonth.map((m) => m.amountCents));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Total spend"
          value={fmtKES(data.totalSpendCents)}
          hint={`${data.billCount} bill(s) · ${data.expenseCount} expense(s)`}
        />
        <Stat label="Still owed" value={fmtKES(data.outstandingCents)} tone={data.outstandingCents > 0 ? "bad" : undefined} />
        <Stat
          label="Share of spend"
          value={data.sharePct === null ? "—" : `${(data.sharePct * 100).toFixed(1)}%`}
          hint="of all vendor spend this period"
        />
        <Stat
          label="Avg days to pay"
          value={data.avgDaysToPay === null ? "—" : String(data.avgDaysToPay)}
          hint={data.avgDaysToPay === null ? "nothing settled yet" : "from document date"}
        />
      </div>

      {data.byAccount.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="text-[12px] font-semibold text-[var(--color-ink-600)] mb-1">What we buy from them</div>
          {data.byAccount.slice(0, 8).map((a) => (
            <Bar key={`${a.accountId ?? "none"}-${a.name}`} label={a.name} amountCents={a.amountCents} maxCents={maxAccount} />
          ))}
        </div>
      )}

      {data.byMonth.length > 1 && (
        <div className="card p-4 space-y-2">
          <div className="text-[12px] font-semibold text-[var(--color-ink-600)] mb-1">Spend by month</div>
          {data.byMonth.map((m) => (
            <Bar key={m.month} label={m.month} amountCents={m.amountCents} maxCents={maxMonth} />
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 hairline-b text-[12px] font-semibold text-[var(--color-ink-600)]">
          Recent documents · {period}
        </div>
        {data.recent.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
            No bills or expenses in this period.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)] hairline-b">
                <th className="text-left px-4 py-2 font-semibold">Document</th>
                <th className="text-left px-2 py-2 font-semibold">Date</th>
                <th className="text-left px-2 py-2 font-semibold">Status</th>
                <th className="text-right px-2 py-2 font-semibold">Total</th>
                <th className="text-right px-4 py-2 font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <td className="px-4 py-2">
                    <Link
                      href={`/purchases/${r.type === "bill" ? "bills" : "expenses"}/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-[var(--color-ink-500)]">{r.date}</td>
                  <td className="px-2 py-2 capitalize text-[var(--color-ink-500)]">{r.status}</td>
                  <td className="px-2 py-2 text-right tnum">{fmtKES(r.totalCents)}</td>
                  <td className="px-4 py-2 text-right tnum font-medium">
                    {r.balanceCents > 0 ? fmtKES(r.balanceCents) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
