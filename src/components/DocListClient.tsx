"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { fmtKES, todayISO } from "@/lib/money";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";

interface Row {
  doc: any;
  contactName: string | null;
}

export function DocListClient({
  type,
  rows,
  basePath,
}: {
  type: string;
  rows: Row[];
  basePath: string;
}) {
  const today = todayISO();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Search
      const searchMatch =
        !q ||
        r.doc.number.toLowerCase().includes(q.toLowerCase()) ||
        (r.contactName || "").toLowerCase().includes(q.toLowerCase());

      // Status
      const isOverdue = r.doc.status === "open" && r.doc.dueDate && r.doc.dueDate < today;
      let statusMatch = true;
      if (status !== "all") {
        if (status === "overdue") statusMatch = isOverdue;
        else statusMatch = r.doc.status === status;
      }

      return searchMatch && statusMatch;
    });
  }, [rows, q, status, today]);

  // Compute stats from ALL rows
  const stats = useMemo(() => {
    let draft = 0,
      pending = 0,
      partial = 0,
      overdue = 0,
      paid = 0;
    for (const { doc } of rows) {
      const isOverdue = doc.status === "open" && doc.dueDate && doc.dueDate < today;
      const amt = doc.totalCents;
      if (doc.status === "draft") draft += amt;
      else if (doc.status === "open") {
        pending += amt;
        if (isOverdue) overdue += amt;
      } else if (doc.status === "partial") {
        partial += amt;
        if (isOverdue) overdue += amt;
      } else if (doc.status === "paid") {
        paid += amt;
      }
    }
    return { draft, pending, partial, overdue, paid };
  }, [rows, today]);

  return (
    <div className="space-y-6 mt-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Draft", value: stats.draft, key: "draft", color: "text-[var(--color-ink-500)]" },
          { label: "Pending", value: stats.pending, key: "open", color: "text-blue-600" },
          { label: "Partial", value: stats.partial, key: "partial", color: "text-orange-500" },
          { label: "Overdue", value: stats.overdue, key: "overdue", color: "text-red-600" },
          { label: "Paid", value: stats.paid, key: "paid", color: "text-green-600" },
        ].map((s) => (
          <div
            key={s.key}
            onClick={() => setStatus(status === s.key ? "all" : s.key)}
            className={`card p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow min-w-0 ${
              status === s.key ? "ring-2 ring-[var(--color-accent-500)]" : ""
            }`}
          >
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[var(--color-ink-500)] font-medium mb-1 truncate">
              {s.label}
            </div>
            <div className={`text-base sm:text-lg font-bold truncate ${s.color}`} title={fmtKES(s.value)}>
              {fmtKES(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <input
          type="text"
          placeholder="Search by number or name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 max-w-xs rounded-md border border-[var(--color-ink-200)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent-500)] focus:ring-1 focus:ring-[var(--color-accent-500)]"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-[var(--color-ink-200)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent-500)] focus:ring-1 focus:ring-[var(--color-accent-500)]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-ink-400)] text-sm border rounded-lg bg-white border-dashed">
          No documents found matching your filters.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Number</Th>
              <Th>{type === "bill" || type === "expense" || type === "purchase_order" ? "Vendor" : "Customer"}</Th>
              <Th>Status</Th>
              <Th right>Total</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ doc: d, contactName }) => (
              <tr key={d.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                <Td>
                  <Link href={`${basePath}/${d.id}`} className="font-medium hover:text-[var(--color-accent-600)]">
                    {d.number}
                  </Link>
                </Td>
                <Td>{contactName ?? "—"}</Td>
                <Td>
                  <StatusPill status={d.status} overdue={d.status === "open" && !!d.dueDate && d.dueDate < today} />
                </Td>
                <Td right>{fmtKES(d.totalCents)}</Td>
                <Td right className="font-medium">
                  {["open", "partial"].includes(d.status) ? fmtKES(d.totalCents - d.paidCents) : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
