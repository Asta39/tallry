"use client";

import { useMemo, useState } from "react";
import { fmtKES } from "@/lib/money";
import { applyEventToInvoiceAction, dismissEventAction } from "./actions";

export interface EventRow {
  id: number;
  date: string;
  gatewayId: string;
  providerRef: string;
  amountCents: number;
  payerPhone: string | null;
  payerName: string | null;
  accountRef: string | null;
  status: string;
}

export interface OpenInvoice {
  id: number;
  number: string;
  outstandingCents: number;
  contactName: string | null;
  contactPhone: string | null;
}

const statusStyles: Record<string, string> = {
  unmatched: "bg-amber-50 text-amber-700",
  amount_mismatch: "bg-red-50 text-red-700",
  received: "bg-blue-50 text-blue-700",
  failed: "bg-red-50 text-red-600",
};

function last9(p: string | null | undefined) {
  return (p || "").replace(/\D/g, "").slice(-9);
}

export function EventsTable({ events, invoices }: { events: EventRow[]; invoices: OpenInvoice[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [selected, setSelected] = useState<Record<number, number>>({});

  // Pre-rank invoice suggestions per event: same phone first, then exact amount
  const suggestions = useMemo(() => {
    const map: Record<number, OpenInvoice[]> = {};
    for (const e of events) {
      const phone = last9(e.payerPhone);
      map[e.id] = [...invoices].sort((a, b) => {
        const score = (inv: OpenInvoice) =>
          (phone && last9(inv.contactPhone) === phone ? 2 : 0) +
          (inv.outstandingCents === e.amountCents ? 1 : 0);
        return score(b) - score(a);
      });
    }
    return map;
  }, [events, invoices]);

  async function apply(eventId: number) {
    const docId = selected[eventId] ?? suggestions[eventId]?.[0]?.id;
    if (!docId) { alert("Select an invoice first"); return; }
    setBusy(eventId);
    try {
      const res = await applyEventToInvoiceAction(eventId, docId);
      if (res && "error" in res && res.error) { alert("Error: " + res.error); return; }
      window.location.reload();
    } finally { setBusy(null); }
  }

  async function dismiss(eventId: number) {
    const reason = prompt("Reason for dismissing this payment event (e.g. test payment, refunded outside system):");
    if (reason === null) return;
    setBusy(eventId);
    try {
      const res = await dismissEventAction(eventId, reason);
      if (res && "error" in res && res.error) { alert("Error: " + res.error); return; }
      window.location.reload();
    } finally { setBusy(null); }
  }

  if (events.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
        Nothing to review — every gateway payment has been matched. 🎉
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((e) => {
        const sugg = suggestions[e.id] || [];
        const phoneMatch = sugg[0] && last9(sugg[0].contactPhone) === last9(e.payerPhone) && last9(e.payerPhone);
        return (
          <div key={e.id} className="card px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-[110px]">
                <div className="font-semibold tnum text-[15px]">{fmtKES(e.amountCents)}</div>
                <div className="text-[11px] text-[var(--color-ink-400)]">{e.date}</div>
              </div>
              <div className="flex-1 min-w-[180px] text-[12.5px]">
                <div className="font-medium">{e.payerName || e.payerPhone || "Unknown payer"}</div>
                <div className="text-[var(--color-ink-400)]">
                  {e.payerPhone && e.payerName ? `${e.payerPhone} · ` : ""}
                  {e.gatewayId === "mpesa_daraja" ? "M-Pesa" : "Kopo Kopo"} · Ref {e.providerRef}
                  {e.accountRef ? ` · typed "${e.accountRef}"` : ""}
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[e.status] || "bg-gray-100 text-gray-600"}`}>
                {e.status.replace("_", " ")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 hairline-t">
              {e.status === "failed" ? (
                <span className="text-[12px] text-[var(--color-ink-400)] flex-1 min-w-[220px]">
                  Cancelled or expired payment attempt — no money was received. Dismiss to clear it.
                </span>
              ) : (
              <select
                className="h-9 px-2 rounded-lg border border-[var(--color-ink-200)] text-[12.5px] max-w-md flex-1 min-w-[220px]"
                value={selected[e.id] ?? sugg[0]?.id ?? ""}
                onChange={(ev) => setSelected(s => ({ ...s, [e.id]: Number(ev.target.value) }))}
              >
                {sugg.length === 0 && <option value="">No open invoices</option>}
                {sugg.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} · {inv.contactName || "No contact"} · {fmtKES(inv.outstandingCents)} due
                  </option>
                ))}
              </select>
              )}
              {e.status !== "failed" && phoneMatch && (
                <span className="text-[11px] text-emerald-600 font-medium">Phone matches top suggestion</span>
              )}
              {e.status !== "failed" && (
              <button
                onClick={() => apply(e.id)}
                disabled={busy === e.id || sugg.length === 0}
                className="h-9 px-4 rounded-lg bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] text-white text-[12.5px] font-medium disabled:opacity-50"
              >
                {busy === e.id ? "Applying..." : "Apply to invoice"}
              </button>
              )}
              <button
                onClick={() => dismiss(e.id)}
                disabled={busy === e.id}
                className="h-9 px-3 rounded-lg border border-[var(--color-ink-200)] text-[12.5px] text-[var(--color-ink-500)] hover:bg-[var(--color-ink-50)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
