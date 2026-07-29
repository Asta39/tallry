"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#0284c7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#34d399", "#fbbf24"];

export interface ChartPoint {
  name: string;
  value: number;
}

const fmt = (v: number) =>
  `Ksh ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Tip({ active, payload, label, money }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value as number;
  return (
    <div className="bg-white border border-[var(--color-ink-200)] p-3 rounded shadow-lg text-sm">
      <p className="font-semibold text-[var(--color-ink-900)] mb-1">{label || payload[0].name}</p>
      <p className="text-[var(--color-ink-600)]">
        <span className="font-medium text-[var(--color-ink-900)]">
          {money ? fmt(v) : v.toLocaleString()}
        </span>
      </p>
    </div>
  );
}

const axisTick = { fontSize: 11, fill: "var(--color-ink-500)" };
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));
const truncate = (s: string) => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

/**
 * Small analytics chart for a report page. `money` scales/labels values as KES
 * (pass values already in shillings, not cents).
 */
export function ReportChart({
  title,
  kind,
  data,
  money = true,
  height = 260,
}: {
  title: string;
  kind: "bar" | "line" | "pie";
  data: ChartPoint[];
  money?: boolean;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Long category names (item/customer names) collide when drawn under vertical
  // bars, so those charts lie on their side and get one label per row instead.
  const sideways = kind === "bar" && data.some((d) => d.name.length > 12);
  if (sideways) height = Math.max(height, 44 * data.length + 40);

  if (!mounted) {
    return (
      <div className="card p-5 no-print">
        <h3 className="font-semibold text-[14px] mb-4">{title}</h3>
        <div style={{ height }} className="w-full bg-[var(--color-ink-50)]/40 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="card p-5 no-print">
      <h3 className="font-semibold text-[14px] mb-4">{title}</h3>
      <div style={{ height }} className="w-full flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-[var(--color-ink-400)] text-sm">Nothing to chart for this period.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {kind === "pie" ? (
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="45%" innerRadius={55} outerRadius={78} paddingAngle={2}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<Tip money={money} />} />
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  iconType="circle"
                  formatter={(v) => <span className="text-[12px] text-[var(--color-ink-700)]">{v}</span>}
                />
              </PieChart>
            ) : kind === "line" ? (
              <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-200)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} />
                <Tooltip content={<Tip money={money} />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 2, fill: "white" }}
                />
              </LineChart>
            ) : sideways ? (
              <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-ink-200)" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  width={130}
                  interval={0}
                  tick={{ ...axisTick, fill: "var(--color-ink-700)" }}
                  tickFormatter={truncate}
                />
                <Tooltip content={<Tip money={money} />} cursor={{ fill: "var(--color-ink-50)" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-200)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} dy={8} interval={0} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={compact} />
                <Tooltip content={<Tip money={money} />} cursor={{ fill: "var(--color-ink-50)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
