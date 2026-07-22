"use client";

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { fmtKES } from "@/lib/money";

const tooltipStyle = {
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
  fontSize: "12.5px",
  padding: "8px 12px",
};
const axisTick = { fontSize: 11, fill: "#86868b" };
const kesTick = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 100_000_000).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${(v / 100_000).toFixed(0)}k` : String(v / 100));

/** Money trend: one or two series (e.g. this year vs last year, gross vs net). */
export function TrendAreaChart({
  data,
  series,
  height = 220,
  money = true,
}: {
  data: Record<string, any>[];
  series: { key: string; label: string; color: string; dashed?: boolean }[];
  height?: number;
  money?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ed" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={44} tickFormatter={money ? kesTick : undefined} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: any, name: any) => [money ? fmtKES(Number(v)) : v, name]}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "4 3" : undefined}
              fill={`url(#grad-${s.key})`}
              dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-line comparison (e.g. gross vs net margin %) — no fill, just lines. */
export function TrendLineChart({
  data,
  series,
  height = 220,
  suffix = "",
}: {
  data: Record<string, any>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  suffix?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ed" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={40} tickFormatter={(v) => `${v}${suffix}`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [`${v}${suffix}`, name]} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranking bars (top customers/items/vendors, etc). */
export function RankBarChart({
  data,
  color = "var(--color-brand, #0f766e)",
  height,
  money = true,
}: {
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  money?: boolean;
}) {
  const h = height ?? Math.max(140, data.length * 34);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8e8ed" />
          <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={money ? kesTick : undefined} />
          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#515154" }} width={120} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [money ? fmtKES(Number(v)) : v, ""]} />
          <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Categorical vertical bars (aging buckets, pipeline stages, hires per month). */
export function CategoryBarChart({
  data,
  color = "var(--color-brand, #0f766e)",
  height = 200,
  money = true,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  money?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ed" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={44} tickFormatter={money ? kesTick : undefined} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [money ? fmtKES(Number(v)) : v, ""]} />
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked two-series bars (new vs returning customers). */
export function StackedBarChart({
  data,
  series,
  height = 200,
}: {
  data: Record<string, any>[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e8ed" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={axisTick} width={30} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} iconType="circle" />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={34} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_COLORS = ["var(--color-brand, #0f766e)", "#5eead4", "#99f6e4", "#a7f3d0", "#fde68a", "#fca5a5", "#d2d2d7", "#86868b"];

/** Breakdown donut with centered total (expense categories). */
export function BreakdownDonut({ data }: { data: { name: string; amountCents: number }[] }) {
  const total = data.reduce((s, d) => s + d.amountCents, 0);
  return (
    <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
      <div className="relative h-40 w-40 shrink-0 mx-auto sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amountCents" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} strokeWidth={0}>
              {data.map((d, i) => <Cell key={d.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: any) => [fmtKES(Number(v)), name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-[15px] font-semibold tnum leading-none">{fmtKES(total).replace(".00", "")}</div>
          <div className="text-[10px] text-[var(--color-ink-400)] mt-1">total</div>
        </div>
      </div>
      <ul className="space-y-1.5 text-[12px] min-w-0 flex-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="text-[var(--color-ink-600)] truncate">{d.name}</span>
            <span className="ml-auto pl-2 font-medium tnum shrink-0">{fmtKES(d.amountCents).replace(".00", "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
