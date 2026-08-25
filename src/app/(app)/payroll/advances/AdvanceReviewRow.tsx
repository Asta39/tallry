"use client";

import { useState } from "react";
import { approveAdvanceRequestAction, rejectAdvanceRequestAction } from "./actions";

export function AdvanceReviewRow({
  requestId,
  banks,
}: {
  requestId: number;
  banks: { id: number; name: string }[];
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [loading, setLoading] = useState(false);
  const [installment, setInstallment] = useState("");
  const [bankId, setBankId] = useState<number | "">(banks[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const inputCls = "rounded-md border border-[var(--color-ink-200)] bg-white px-2 py-1 text-[12px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";

  if (mode === "idle") {
    return (
      <div className="flex gap-2 justify-end">
        <button onClick={() => setMode("approve")} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline">Approve</button>
        <button onClick={() => setMode("reject")} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline">Reject</button>
      </div>
    );
  }

  if (mode === "reject") {
    return (
      <div className="flex flex-col items-end gap-1.5 py-1">
        <div className="flex items-center gap-1.5">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className={`${inputCls} w-40`} />
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await rejectAdvanceRequestAction(requestId, note);
                window.location.reload();
              } catch (e: any) {
                setError(e.message || "Failed");
                setLoading(false);
              }
            }}
            className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
          >
            {loading ? "Working…" : "Confirm reject"}
          </button>
          <button onClick={() => setMode("idle")} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
        </div>
        {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
      </div>
    );
  }

  return (
    <form
      action={approveAdvanceRequestAction}
      className="flex flex-col items-end gap-1.5 py-1"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <input
          name="installment"
          type="number"
          min="1"
          step="0.01"
          required
          value={installment}
          onChange={(e) => setInstallment(e.target.value)}
          placeholder="Monthly deduction (KSh)"
          className={`${inputCls} w-40`}
        />
        <select name="disbursedFromBankAccountId" value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")} className={inputCls}>
          <option value="">Paid from…</option>
          {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="submit" className="text-[11.5px] font-medium text-[var(--color-accent-600)] hover:underline">Confirm approve</button>
        <button type="button" onClick={() => setMode("idle")} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
    </form>
  );
}
