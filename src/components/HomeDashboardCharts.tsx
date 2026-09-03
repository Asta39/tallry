"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  fontSize: "12.5px",
  padding: "8px 12px",
};

const STATUS_COLORS: Record<string, string> = {
  paid: "#0f766e",
  open: "#2563eb",
  partial: "#d97706",
  overdue: "#dc2626",
  draft: "#9ca3af",
};
const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  open: "Awaiting payment",
  partial: "Partly paid",
  overdue: "Overdue",
  draft: "Draft",
};

/** Compact donut of this year's invoice mix by status — the "shape" of your
 *  receivables at a glance, not just a total. */
export function InvoiceStatusDonut({ counts }: { counts: Record<string, number> }) {
  const mounted = useMounted();
  const order = ["paid", "open", "partial", "overdue", "draft"];
  const data = order.filter((k) => counts[k] > 0).map((k) => ({ key: k, value: counts[k] }));
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-[12.5px] text-[var(--color-ink-400)]">
        No invoices this year yet.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 shrink-0">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="key" innerRadius={44} outerRadius={64} paddingAngle={2} strokeWidth={0}>
                {data.map((d) => (
                  <Cell key={d.key} fill={STATUS_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`${v} invoice${v === 1 ? "" : "s"}`, STATUS_LABELS[name as string] || name]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-36 w-36 rounded-full bg-[var(--color-ink-50)]/40 animate-pulse" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[18px] font-semibold tnum leading-none">{total}</div>
          <div className="text-[10px] text-[var(--color-ink-400)] mt-1">invoices</div>
        </div>
      </div>
      <ul className="space-y-2 text-[12px] min-w-0">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.key] }} />
            <span className="text-[var(--color-ink-600)]">{STATUS_LABELS[d.key]}</span>
            <span className="ml-auto pl-3 font-medium tnum">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
