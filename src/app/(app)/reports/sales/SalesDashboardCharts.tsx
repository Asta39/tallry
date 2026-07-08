"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

const COLORS = ["#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#e0f2fe", "#bae6fd"];
const ALT_COLORS = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

export function SalesDashboardCharts({ stats }: { stats: any }) {
  // Format income trend data
  const incomeTrendData = stats.incomeTrend.map((t: any) => ({
    name: t.label,
    Income: t.incomeCents / 100,
  }));

  // Format payment modes data
  const paymentModesData = stats.paymentModes.map((p: any) => ({
    name: p.mode.charAt(0).toUpperCase() + p.mode.slice(1).replace("_", " "),
    value: p.amountCents / 100,
  }));

  // Format top customers data
  const topCustomersData = stats.topCustomers.map((c: any) => ({
    name: c.name,
    Sales: c.amountCents / 100,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[var(--color-ink-200)] p-3 rounded shadow-lg text-sm">
          <p className="font-semibold text-[var(--color-ink-900)] mb-1">{label || payload[0].name}</p>
          <p className="text-[var(--color-ink-600)]">
            Amount: <span className="font-medium text-[var(--color-ink-900)]">Ksh {payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Total Income Chart */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-[14px]">Total Income (Last 6 Months)</h3>
        </div>
        <div className="h-64 sm:h-72 w-full flex items-center justify-center">
          {incomeTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-ink-200)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-ink-500)" }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "var(--color-ink-500)" }}
                  tickFormatter={(val) => val >= 1000 ? `Ksh ${(val/1000).toFixed(0)}k` : val}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="Income" 
                  stroke="var(--color-accent)" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                  activeDot={{ r: 6, fill: "var(--color-accent)", stroke: "white", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[var(--color-ink-400)] text-sm">No income data available.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Modes Chart */}
        <div className="card p-5 flex flex-col flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-[14px]">Payment Modes (This Month)</h3>
          </div>
          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {paymentModesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentModesData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {paymentModesData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[12px] text-[var(--color-ink-700)]">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[var(--color-ink-400)] text-sm">No payment data available.</div>
            )}
          </div>
        </div>

        {/* Top Customers Chart */}
        <div className="card p-5 flex flex-col flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-[14px]">Top Customers (This Year)</h3>
          </div>
          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            {topCustomersData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomersData} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-ink-200)" />
                  <XAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "var(--color-ink-500)" }}
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    width={90}
                    tick={{ fontSize: 11, fill: "var(--color-ink-700)" }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-ink-50)' }} />
                  <Bar dataKey="Sales" radius={[0, 4, 4, 0]}>
                    {topCustomersData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={ALT_COLORS[index % ALT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[var(--color-ink-400)] text-sm">No sales data available.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
