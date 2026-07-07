"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fmtKES, todayISO } from "@/lib/money";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";

interface Row {
  doc: any;
  contactName: string | null;
}

export function DocListClient({
  type,
  rows,
  stats,
  totalCount,
  basePath,
  isTemplate,
  currentPage,
}: {
  type: string;
  rows: Row[];
  stats: { draft: number; pending: number; partial: number; overdue: number; paid: number };
  totalCount: number;
  basePath: string;
  isTemplate?: boolean;
  currentPage: number;
}) {
  const today = todayISO();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const status = searchParams.get("status") || "all";

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentQ = searchParams.get("q") || "";
      if (q !== currentQ) {
        updateUrl(q, status, 1);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [q, status, searchParams]);

  function updateUrl(newQ: string, newStatus: string, newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newQ) params.set("q", newQ);
    else params.delete("q");
    
    if (newStatus && newStatus !== "all") params.set("status", newStatus);
    else params.delete("status");

    if (newPage > 1) params.set("page", newPage.toString());
    else params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const hasNextPage = currentPage * 50 < totalCount;

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
            onClick={() => updateUrl(q, status === s.key ? "all" : s.key, 1)}
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
          onChange={(e) => updateUrl(q, e.target.value, 1)}
          className="rounded-md border border-[var(--color-ink-200)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-accent-500)] focus:ring-1 focus:ring-[var(--color-accent-500)]"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        {isPending && <span className="text-sm text-[var(--color-ink-400)]">Loading...</span>}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
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
          <tbody className={isPending ? "opacity-50 transition-opacity" : ""}>
            {rows.map(({ doc: d, contactName }) => (
              <tr key={d.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                <Td>
                  <Link
                    href={isTemplate ? `${basePath}/new?templateId=${d.id}` : `${basePath}/${d.id}`}
                    className="font-medium hover:text-[var(--color-accent-600)]"
                  >
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

      {/* Pagination */}
      {totalCount > 50 && (
        <div className="flex justify-between items-center text-sm text-[var(--color-ink-500)]">
          <div>
            Showing {(currentPage - 1) * 50 + 1} to {Math.min(currentPage * 50, totalCount)} of {totalCount}
          </div>
          <div className="flex gap-2">
            <button
              disabled={currentPage <= 1 || isPending}
              onClick={() => updateUrl(q, status, currentPage - 1)}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={!hasNextPage || isPending}
              onClick={() => updateUrl(q, status, currentPage + 1)}
              className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
