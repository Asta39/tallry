"use client";

import { useRef, useState, useTransition } from "react";
import { fmtKES } from "@/lib/money";
import {
  setOrgMonthlyFeeAction,
  activateOrgAction,
  recordMaintenancePaymentAction,
  suspendOrgAction,
  reinstateOrgAction,
} from "../../actions";

interface PaymentRow {
  id: number;
  kind: string;
  amountCents: number;
  method: string;
  state: string;
  createdAt: string;
  note: string | null;
}

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all";

export function BillingPanel({
  orgId,
  status,
  trialEndsAt,
  needsActivation,
  monthlyFeeCents,
  suggestedMonthlyFeeCents,
  activeStaffCount,
  nextMaintenanceDueAt,
  createdAt,
  isSuspended,
  history,
}: {
  orgId: number;
  status: "trial" | "active" | "locked";
  trialEndsAt: string;
  needsActivation: boolean;
  monthlyFeeCents: number;
  /** activeStaffCount × KSh 1,000 — auto-filled into the fee field, still editable. */
  suggestedMonthlyFeeCents: number;
  activeStaffCount: number;
  nextMaintenanceDueAt: string | null;
  createdAt: string;
  isSuspended: boolean;
  history: PaymentRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const activateFeeRef = useRef<HTMLInputElement>(null);
  const monthlyFeeRef = useRef<HTMLInputElement>(null);
  const suggestedFeeKES = (suggestedMonthlyFeeCents / 100).toFixed(2);

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-t border-[var(--color-ink-100)] first:border-t-0 text-[13px]">
      <span className="text-[var(--color-ink-400)]">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );

  function run(action: () => Promise<{ success?: boolean; error?: string } | undefined>, okMsg: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
      else setSuccess(okMsg);
    });
  }

  return (
    <div>
      <div className="mb-4">
        <Row k="Status" v={status === "trial" ? `Trial (ends ${trialEndsAt})` : status === "locked" ? <span className="text-[var(--color-bad)]">Locked</span> : "Active"} />
        <Row k="Since" v={createdAt} />
        <Row k="Monthly fee" v={monthlyFeeCents > 0 ? fmtKES(monthlyFeeCents) : "Not set"} />
        {nextMaintenanceDueAt && <Row k="Next maintenance due" v={nextMaintenanceDueAt} />}
      </div>

      {needsActivation && (
        <form
          className="pt-3 border-t border-[var(--color-ink-100)] space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() => activateOrgAction(orgId, fd), "Activated.");
          }}
        >
          <div className="text-[11.5px] text-[var(--color-ink-400)] mb-1">Record the one-time setup fee received to activate this org — works any time, trial-expired or not</div>
          <div className="flex flex-wrap gap-2">
            <input name="setupFeeAmount" type="number" step="0.01" min="0.01" required placeholder="Setup fee (KES)" className={inputCls} />
            <input name="setupFeeDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
          </div>
          <input name="setupFeeNote" type="text" placeholder="Note (optional)" className={`${inputCls} w-full`} />
          <div>
            <span className="block text-[11.5px] font-medium text-[var(--color-ink-600)] mb-1">
              Monthly fee (KES) — auto: {activeStaffCount} staff × KSh 1,000
            </span>
            <div className="flex gap-2">
              <input ref={activateFeeRef} name="monthlyFee" type="number" step="0.01" min="0" defaultValue={suggestedFeeKES} className={inputCls} />
              <button
                type="button"
                onClick={() => { if (activateFeeRef.current) activateFeeRef.current.value = suggestedFeeKES; }}
                className="text-[11.5px] font-medium text-[var(--color-accent-600)] hover:underline shrink-0"
              >
                Reset to auto
              </button>
            </div>
          </div>
          <button type="submit" disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2">
            {pending ? "Saving…" : "Activate"}
          </button>
        </form>
      )}

      {!needsActivation && (
        <div className="pt-3 border-t border-[var(--color-ink-100)] space-y-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => setOrgMonthlyFeeAction(orgId, fd), "Monthly fee updated.");
            }}
          >
            <label>
              <span className="block text-[11.5px] font-medium text-[var(--color-ink-600)] mb-1">Monthly fee (KES)</span>
              <input ref={monthlyFeeRef} name="monthlyFee" type="number" step="0.01" min="0" defaultValue={(monthlyFeeCents / 100).toFixed(2)} className={inputCls} />
            </label>
            <button
              type="button"
              onClick={() => { if (monthlyFeeRef.current) monthlyFeeRef.current.value = suggestedFeeKES; }}
              className="text-[11.5px] font-medium text-[var(--color-accent-600)] hover:underline"
            >
              Recalc: {activeStaffCount} staff × 1,000
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2">
              Save
            </button>
          </form>

          {!showRecordPayment ? (
            <button onClick={() => setShowRecordPayment(true)} className="text-[12.5px] font-medium text-[var(--color-accent-600)] hover:underline">
              Record a maintenance payment made outside the app
            </button>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() => recordMaintenancePaymentAction(orgId, fd), "Payment recorded.");
                setShowRecordPayment(false);
              }}
            >
              <div className="flex flex-wrap gap-2">
                <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount (KES)" className={inputCls} />
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
                <select name="method" className={inputCls}>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <input name="note" type="text" placeholder="Note (optional)" className={`${inputCls} w-full`} />
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2">
                  {pending ? "Saving…" : "Record payment"}
                </button>
                <button type="button" onClick={() => setShowRecordPayment(false)} className="rounded-lg border border-[var(--color-ink-200)] text-[13px] font-medium px-4 py-2">
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div>
            {isSuspended ? (
              <button
                disabled={pending}
                onClick={() => run(() => reinstateOrgAction(orgId), "Reinstated.")}
                className="text-[12.5px] font-medium text-[var(--color-good)] hover:underline"
              >
                Reinstate access
              </button>
            ) : (
              <button
                disabled={pending}
                onClick={() => {
                  if (!confirm("Suspend this org's access? Every page will lock immediately.")) return;
                  run(() => suspendOrgAction(orgId), "Suspended.");
                }}
                className="text-[12.5px] font-medium text-[var(--color-bad)] hover:underline"
              >
                Suspend access
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[12px] text-[var(--color-bad)]">{error}</p>}
      {success && <p className="mt-2 text-[12px] text-[var(--color-good)]">{success}</p>}

      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-ink-100)]">
          <div className="text-[11.5px] text-[var(--color-ink-400)] mb-2">Payment history</div>
          <ul className="divide-y divide-[var(--color-ink-100)]">
            {history.map((p) => (
              <li key={p.id} className="py-1.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-ink-500)]">{p.createdAt.slice(0, 10)} · {p.kind === "setup_fee" ? "Setup fee" : "Maintenance"} · {p.method}</span>
                <span className="font-medium">{fmtKES(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
