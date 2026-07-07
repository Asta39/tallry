import Link from "next/link";
import { fmtKES } from "@/lib/money";

/**
 * Invoice & quote status overview — counts, share bars, money totals.
 * Server component; data from reports.docStatusOverview.
 */

function Row({
  count,
  label,
  total,
  color,
  href,
}: {
  count: number;
  label: string;
  total: number;
  color: string;
  href: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <Link href={href} className="block group py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px]">
          <span className="font-semibold tnum" style={{ color }}>{count}</span>{" "}
          <span className="text-[var(--color-ink-600)] group-hover:text-[var(--color-ink-900)]">{label}</span>
        </span>
        <span className="text-[11.5px] text-[var(--color-ink-400)] tnum">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-[5px] rounded-full bg-[var(--color-ink-100)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%`, background: color }} />
      </div>
    </Link>
  );
}

const C = {
  gray: "#86868b",
  slate: "#515154",
  blue: "#2563eb",
  red: "#c0392b",
  amber: "#b8860b",
  green: "#1f8a4c",
};

export function DocOverview({
  data,
  year,
  years,
}: {
  data: {
    inv: { draft: number; open: number; partial: number; overdue: number; paid: number; void: number };
    invTotal: number;
    qt: { draft: number; open: number; accepted: number; declined: number };
    qtTotal: number;
    outstandingCents: number;
    pastDueCents: number;
    paidCents: number;
  };
  year: string;
  years: string[];
}) {
  return (
    <div className="card p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <div>
          <div className="text-[13.5px] font-semibold mb-2">Invoice overview</div>
          <Row count={data.inv.draft} label="Draft" total={data.invTotal} color={C.gray} href="/sales/invoices" />
          <Row count={data.inv.open} label="Awaiting payment" total={data.invTotal} color={C.blue} href="/sales/invoices" />
          <Row count={data.inv.partial} label="Partially paid" total={data.invTotal} color={C.amber} href="/sales/invoices" />
          <Row count={data.inv.overdue} label="Overdue" total={data.invTotal} color={C.red} href="/reports/aging" />
          <Row count={data.inv.paid} label="Paid" total={data.invTotal} color={C.green} href="/sales/invoices" />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold mb-2">Quote overview</div>
          <Row count={data.qt.draft} label="Draft" total={data.qtTotal} color={C.gray} href="/sales/quotes" />
          <Row count={data.qt.open} label="Sent" total={data.qtTotal} color={C.blue} href="/sales/quotes" />
          <Row count={data.qt.accepted} label="Accepted" total={data.qtTotal} color={C.green} href="/sales/quotes" />
          <Row count={data.qt.declined} label="Declined" total={data.qtTotal} color={C.red} href="/sales/quotes" />
        </div>
      </div>

      <div className="hairline-t mt-5 pt-4">
        <form className="flex justify-end mb-3">
          <select
            name="year"
            defaultValue={year}
            className="rounded-md border border-[var(--color-ink-200)] px-2 py-1 text-[12.5px] bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button className="ml-2 rounded-md border border-[var(--color-ink-200)] bg-white px-2.5 py-1 text-[12.5px] font-medium hover:bg-[var(--color-ink-50)]">
            Go
          </button>
        </form>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[var(--color-ink-100)] px-4 py-3">
            <div className="text-[12px] font-medium" style={{ color: C.amber }}>Outstanding invoices</div>
            <div className="text-[17px] font-semibold tnum mt-0.5">{fmtKES(data.outstandingCents)}</div>
          </div>
          <div className="rounded-lg border border-[var(--color-ink-100)] px-4 py-3">
            <div className="text-[12px] font-medium text-[var(--color-ink-600)]">Past due invoices</div>
            <div className="text-[17px] font-semibold tnum mt-0.5" style={{ color: data.pastDueCents > 0 ? C.red : undefined }}>
              {fmtKES(data.pastDueCents)}
            </div>
          </div>
          <div className="rounded-lg border border-[var(--color-ink-100)] px-4 py-3">
            <div className="text-[12px] font-medium" style={{ color: C.green }}>Paid invoices</div>
            <div className="text-[17px] font-semibold tnum mt-0.5">{fmtKES(data.paidCents)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
