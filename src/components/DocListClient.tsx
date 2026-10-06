"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { fmtKES, todayISO } from "@/lib/money";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";
import { useRealtimeTable } from "@/lib/realtime/useRealtimeTable";
import { mergeQuotesAction } from "@/lib/actions";
import { MERGEABLE_QUOTE_STATUSES } from "@/lib/quote-merge";

interface Row {
  doc: any;
  contactName: string | null;
}

export function DocListClient({
  orgId,
  type,
  rows,
  stats,
  totalCount,
  basePath,
  isTemplate,
  currentPage,
  showPaidCard = true,
}: {
  orgId: number;
  type: string;
  rows: Row[];
  stats: { draft: number; pending: number; partial: number; overdue: number; paid: number };
  totalCount: number;
  basePath: string;
  isTemplate?: boolean;
  currentPage: number;
  showPaidCard?: boolean;
}) {
  const today = todayISO();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // This list is server-filtered/sorted/paginated (search, status, page) —
  // patching individual rows client-side could put a changed doc on the
  // wrong page or in the wrong sort position. Re-running the server query
  // is the only reliable way to reflect a change, so any insert/update/
  // delete of this doc type just triggers a refresh (debounced so a burst
  // of webhook-driven updates, e.g. a payment run, doesn't hammer the server).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 400);
  };
  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  useRealtimeTable<{ id: number; type: string }>(
    "documents",
    { column: "org_id", value: orgId },
    {
      onInsert: (row) => { if (row.type === type) scheduleRefresh(); },
      onUpdate: (row) => { if (row.type === type) scheduleRefresh(); },
      // DELETE payloads only carry the primary key unless REPLICA IDENTITY
      // FULL is set (it isn't) — `type` isn't available to filter on, so
      // refresh unconditionally rather than silently miss a real deletion.
      onDelete: scheduleRefresh,
      onUnreliable: scheduleRefresh,
    }
  );

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

  // Quotes: pick several for the same customer and merge them into one.
  const canMerge = type === "quote" && !isTemplate;
  const mergeable = (d: any) => (MERGEABLE_QUOTE_STATUSES as readonly string[]).includes(d.status);
  const [selected, setSelected] = useState<number[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [merging, startMerge] = useTransition();
  // Drop selections that left the page (filter, search or page change).
  useEffect(() => {
    setSelected((s) => s.filter((id) => rows.some((r) => r.doc.id === id && mergeable(r.doc))));
  }, [rows]);
  const selectedRows = rows.filter((r) => selected.includes(r.doc.id));
  const toggle = (id: number) => {
    setMergeError(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const sameCustomer = selectedRows.length > 0 && selectedRows.every((r) => r.doc.contactId === selectedRows[0].doc.contactId);
  function merge() {
    const numbers = selectedRows.map((r) => r.doc.number).join(", ");
    if (!window.confirm(`Merge ${numbers} into one new quote? The originals will be marked "Merged" and can't be converted on their own.`)) return;
    startMerge(async () => {
      const res = await mergeQuotesAction(selected);
      if (res.error || !res.id) {
        setMergeError(res.error || "Couldn't merge those quotes");
        return;
      }
      setSelected([]);
      router.push(`${basePath}/${res.id}`);
    });
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Draft", value: stats.draft, key: "draft", color: "text-[var(--color-ink-500)]" },
          { label: "Pending", value: stats.pending, key: "open", color: "text-blue-600" },
          { label: "Partial", value: stats.partial, key: "partial", color: "text-orange-500" },
          { label: "Overdue", value: stats.overdue, key: "overdue", color: "text-red-600" },
          ...(showPaidCard ? [{ label: "Paid", value: stats.paid, key: "paid", color: "text-green-600" }] : []),
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
            <div className={`stat-figure text-base sm:text-lg font-bold truncate ${s.color}`} title={fmtKES(s.value)}>
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

      {canMerge && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-ink-200)] bg-white px-4 py-2.5 text-[13px]">
          <span className="font-medium">{selected.length} selected</span>
          {!sameCustomer && <span className="text-[var(--color-bad)]">Pick quotes for the same customer to merge them</span>}
          {mergeError && <span className="text-[var(--color-bad)]">{mergeError}</span>}
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => { setSelected([]); setMergeError(null); }} className="px-3 py-1.5 text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
              Clear
            </button>
            <button
              type="button"
              onClick={merge}
              disabled={selected.length < 2 || !sameCustomer || merging}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white font-medium px-4 py-1.5"
            >
              {merging ? "Merging…" : "Merge into one quote"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-ink-400)] text-sm border rounded-lg bg-white border-dashed">
          No documents found matching your filters.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              {canMerge && <Th><span className="sr-only">Select</span></Th>}
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
                {canMerge && (
                  <Td className="w-8">
                    <input
                      type="checkbox"
                      aria-label={`Select ${d.number}`}
                      checked={selected.includes(d.id)}
                      disabled={!mergeable(d)}
                      title={mergeable(d) ? "Select to merge" : "Only draft, sent or accepted quotes can be merged"}
                      onChange={() => toggle(d.id)}
                      className="rounded border-[var(--color-ink-300)] text-[var(--color-accent-500)] focus:ring-[var(--color-accent-500)] disabled:opacity-30"
                    />
                  </Td>
                )}
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
                  <StatusPill status={d.status} overdue={(d.status === "open" || d.status === "partial") && !!d.dueDate && d.dueDate < today} docType={type} />
                </Td>
                <Td right>{fmtKES(d.totalCents)}</Td>
                <Td right className="font-medium">
                  {["open", "partial"].includes(d.status) ? fmtKES(d.totalCents - d.paidCents - (d.creditedCents ?? 0)) : "—"}
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
