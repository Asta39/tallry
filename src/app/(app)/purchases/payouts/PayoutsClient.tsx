"use client";

import { useState, useTransition } from "react";
import { fmtKES } from "@/lib/money";
import { confirmStuckPayoutAction, markStuckPayoutFailedAction } from "./actions";

type Row = {
  id: number;
  gatewayId: string;
  providerRef: string;
  amountCents: number;
  payerPhone: string | null;
  createdAt: string;
  label: string;
  detail?: string;
};

function GATEWAY_LABEL(id: string) {
  return id === "mpesa_daraja" ? "M-Pesa Daraja" : id === "kopokopo" ? "Kopo Kopo" : id;
}

function RowActions({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [showFail, setShowFail] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    if (!window.confirm("Confirm this payout actually went through (checked on the gateway's own dashboard)? This will post the payment.")) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmStuckPayoutAction(id);
      if (res?.error) { setError(res.error); return; }
      window.location.reload();
    });
  }

  function fail() {
    setError(null);
    startTransition(async () => {
      const res = await markStuckPayoutFailedAction(id, note);
      if (res?.error) { setError(res.error); return; }
      window.location.reload();
    });
  }

  if (showFail) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it failed (optional)"
            className="w-40 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
          />
          <button disabled={pending} onClick={fail} className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50">
            Confirm failed
          </button>
          <button onClick={() => setShowFail(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
        </div>
        {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <button disabled={pending} onClick={handleConfirm} className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50">
          {pending ? "Working…" : "Confirm — money moved"}
        </button>
        <button disabled={pending} onClick={() => setShowFail(true)} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50">
          Mark failed
        </button>
      </div>
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}

export function PayoutsClient({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-[13px] text-[var(--color-ink-400)]">
        No stuck payouts — everything sent via gateway has either confirmed or is still fresh.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="hairline-b bg-[var(--color-ink-50)]">
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Sent</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">For</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Gateway</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Reference</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)] text-right">Amount</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)] text-right w-64">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-[var(--color-ink-500)] whitespace-nowrap">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{r.label}</div>
                {r.detail && <div className="text-[11.5px] text-[var(--color-ink-400)]">{r.detail}</div>}
                {r.payerPhone && <div className="text-[11.5px] text-[var(--color-ink-400)]">To {r.payerPhone}</div>}
              </td>
              <td className="px-4 py-3">{GATEWAY_LABEL(r.gatewayId)}</td>
              <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--color-ink-500)]">{r.providerRef}</td>
              <td className="px-4 py-3 text-right font-medium tnum">{fmtKES(r.amountCents)}</td>
              <td className="px-4 py-3 text-right"><RowActions id={r.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
