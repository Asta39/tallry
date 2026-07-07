"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fmtKES } from "@/lib/money";

export function IncomeExpenseChart({ data }: { data: { month: string; label: string; incomeCents: number; expenseCents: number }[] }) {
  // Convert cents to standard units for the chart
  const formattedData = data.map((d) => ({
    ...d,
    Income: d.incomeCents / 100,
    Expense: d.expenseCents / 100,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5ea" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#86868b" }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#86868b" }}
            tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`}
            dx={-10}
          />
          <Tooltip 
            cursor={{ fill: "#f5f5f7" }}
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: "13px" }}
            formatter={(value: any) => fmtKES(Number(value) * 100)}
          />
          <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }} iconType="circle" />
          <Bar dataKey="Income" fill="#34c759" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Expense" fill="#ff3b30" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
