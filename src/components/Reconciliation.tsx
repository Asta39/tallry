"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import {
  startReconciliation,
  getReconciliationState,
  tickReconTxn,
  completeReconciliation,
  cancelReconciliation,
  type ReconciliationState,
} from "@/lib/phase-a-actions";

/**
 * Bank reconciliation: pick an account, enter the real statement's closing
 * balance, tick transactions until the difference hits zero, complete.
 */
export function Reconciliation({
  banks,
  openRec,
}: {
  banks: { id: number; label: string }[];
  /** an in-progress session found on page load, if any */
  openRec: { id: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<ReconciliationState | null>(null);
  const [expanded, setExpanded] = useState(!!openRec);

  // start form
  const [bankId, setBankId] = useState<number>(banks[0]?.id ?? 0);
  const [stmtDate, setStmtDate] = useState(todayISO());
  const [stmtBal, setStmtBal] = useState("");

  async function refresh(recId: number) {
    const s = await getReconciliationState(recId);
    setState(s);
  }

  function begin() {
    setError(null);
    const bal = parseKES(stmtBal);
    if (Number.isNaN(bal)) return setError("Enter the closing balance from your bank/M-Pesa statement.");
    start(async () => {
      try {
        const id = await startReconciliation({
          bankAccountId: bankId,
          statementDate: stmtDate,
          statementBalanceCents: bal,
        });
        await refresh(id);
        setExpanded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start");
      }
    });
  }

  function resume() {
    if (!openRec) return;
    start(async () => {
      await refresh(openRec.id);
      setExpanded(true);
    });
  }

  function tick(txnId: number, on: boolean) {
    if (!state) return;
    // optimistic
    setState({
      ...state,
      candidates: state.candidates.map((c) => (c.id === txnId ? { ...c, ticked: on } : c)),
      tickedCents: state.tickedCents + (on ? 1 : -1) * (state.candidates.find((c) => c.id === txnId)?.amountCents ?? 0),
      differenceCents:
        state.differenceCents - (on ? 1 : -1) * (state.candidates.find((c) => c.id === txnId)?.amountCents ?? 0),
    });
    start(async () => {
      await tickReconTxn(state.rec.id, txnId, on);
    });
  }

  function complete() {
    if (!state) return;
    setError(null);
    start(async () => {
      try {
        await completeReconciliation(state.rec.id);
        setState(null);
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not complete");
      }
    });
  }

  function cancel() {
    if (!state) return;
    start(async () => {
      await cancelReconciliation(state.rec.id);
      setState(null);
      setExpanded(false);
      router.refresh();
    });
  }

  const inputCls =
    "rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

  return (
    <div className="card p-4">
      {!state && (
        <>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[13px] font-medium">Reconcile with your statement</span>
            <span className="text-[11.5px] text-[var(--color-ink-400)]">
              Tick each transaction that appears on the real statement until the difference is zero
            </span>
          </div>
          {done && (
            <div className="mt-2 text-[12.5px] text-[var(--color-good)] font-medium">
              ✓ Reconciled — books match the statement.
            </div>
          )}
          <div className="mt-3 flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="text-[12px] text-[var(--color-ink-600)]">Account</span>
              <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))} className={`${inputCls} block mt-1`}>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-ink-600)]">Statement date</span>
              <input type="date" value={stmtDate} onChange={(e) => setStmtDate(e.target.value)} className={`${inputCls} block mt-1`} />
            </label>
            <label className="block">
              <span className="text-[12px] text-[var(--color-ink-600)]">Statement closing balance (KSh)</span>
              <input value={stmtBal} onChange={(e) => setStmtBal(e.target.value)} placeholder="0.00" className={`${inputCls} block mt-1 w-44`} />
            </label>
            <button
              onClick={begin}
              disabled={pending || !bankId}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
            >
              {pending ? "Starting…" : "Start reconciliation"}
            </button>
            {openRec && !expanded && (
              <button onClick={resume} disabled={pending} className="rounded-lg border border-[var(--color-ink-200)] bg-white text-[13px] font-medium px-4 py-2">
                Resume open session
              </button>
            )}
          </div>
          {error && <div className="mt-2 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
        </>
      )}

      {state && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-[13px] font-medium">
              Reconciling to {state.rec.statementDate} · statement balance {fmtKES(state.rec.statementBalanceCents)}
            </div>
            <button onClick={cancel} disabled={pending} className="text-[12.5px] text-[var(--color-ink-400)] hover:text-[var(--color-bad)]">
              Cancel session
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg border border-[var(--color-ink-100)] px-3 py-2">
              <div className="text-[11px] text-[var(--color-ink-400)]">Books balance (ledger)</div>
              <div className="text-[13.5px] font-semibold tnum">{fmtKES(state.ledgerBalanceCents)}</div>
            </div>
            <div className="rounded-lg border border-[var(--color-ink-100)] px-3 py-2">
              <div className="text-[11px] text-[var(--color-ink-400)]">Previously reconciled</div>
              <div className="text-[13.5px] font-semibold tnum">{fmtKES(state.alreadyReconciledCents)}</div>
            </div>
            <div className="rounded-lg border border-[var(--color-ink-100)] px-3 py-2">
              <div className="text-[11px] text-[var(--color-ink-400)]">Ticked this session</div>
              <div className="text-[13.5px] font-semibold tnum">{fmtKES(state.tickedCents)}</div>
            </div>
            <div className="rounded-lg border border-[var(--color-ink-100)] px-3 py-2">
              <div className="text-[11px] text-[var(--color-ink-400)]">Statement balance</div>
              <div className="text-[13.5px] font-semibold tnum">{fmtKES(state.rec.statementBalanceCents)}</div>
            </div>
            <div
              className="rounded-lg px-3 py-2 border"
              style={{
                borderColor: state.differenceCents === 0 ? "#1f8a4c" : "#c0392b",
                background: state.differenceCents === 0 ? "#f0faf4" : "#fdf2f1",
              }}
            >
              <div className="text-[11px] text-[var(--color-ink-400)]">Difference</div>
              <div className={`text-[13.5px] font-bold tnum ${state.differenceCents === 0 ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
                {fmtKES(state.differenceCents)}
              </div>
            </div>
          </div>

          {state.uncategorizedCount > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[12px] text-amber-800">
              {state.uncategorizedCount} transaction{state.uncategorizedCount > 1 ? "s" : ""} dated on/before the
              statement date {state.uncategorizedCount > 1 ? "are" : "is"} not booked yet — categorize
              {state.uncategorizedCount > 1 ? " them" : " it"} in the Transactions list below first, then
              {state.uncategorizedCount > 1 ? " they" : " it"} will appear here.
            </div>
          )}

          <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-[var(--color-ink-100)]">
            <table className="w-full text-[12.5px]">
              <tbody>
                {state.candidates.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-ink-100)] last:border-0 hover:bg-[var(--color-ink-50)]/50">
                    <td className="px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={c.ticked}
                        onChange={(e) => tick(c.id, e.target.checked)}
                        className="accent-[var(--color-accent-500)]"
                      />
                    </td>
                    <td className="px-2 py-2 text-[var(--color-ink-400)] whitespace-nowrap">{c.date}</td>
                    <td className="px-2 py-2">{c.description.slice(0, 70)}</td>
                    <td className={`px-3 py-2 text-right tnum whitespace-nowrap ${c.amountCents < 0 ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}`}>
                      {fmtKES(c.amountCents, { signed: true })}
                    </td>
                  </tr>
                ))}
                {state.candidates.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-[var(--color-ink-400)]" colSpan={4}>
                      No unreconciled transactions dated on/before the statement date. Import or add them first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && <div className="mt-2 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={complete}
              disabled={pending || state.differenceCents !== 0}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
            >
              {state.differenceCents === 0 ? "Complete reconciliation ✓" : "Difference must be zero"}
            </button>
            <span className="text-[11.5px] text-[var(--color-ink-400)]">
              Ticked lines are marked reconciled and locked out of future sessions.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
