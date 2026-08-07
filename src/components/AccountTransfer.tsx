"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import { transferBetweenAccounts } from "@/lib/phase-a-actions";
import { isStaleServerActionError, STALE_ACTION_MESSAGE } from "@/lib/stale-action";

/** Move money between the org's own accounts (Petty Cash, Main Bank,
 *  M-Pesa Till, etc.) — a pure balance-sheet transfer, never income or
 *  expense. Lives right next to Reconcile since a transfer is exactly the
 *  kind of movement that shows up as an unreconciled line on both accounts
 *  afterward. */
export function AccountTransfer({ banks }: { banks: { id: number; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fromId, setFromId] = useState<number>(banks[0]?.id ?? 0);
  const [toId, setToId] = useState<number>(banks[1]?.id ?? banks[0]?.id ?? 0);
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const input =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
  const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const amt = parseKES(amount);
    if (!amt || amt <= 0) return setError("Enter an amount greater than zero.");
    if (fromId === toId) return setError("Source and destination must be different accounts.");

    start(async () => {
      try {
        const res = await transferBetweenAccounts({
          date,
          amountCents: amt,
          fromBankAccountId: fromId,
          toBankAccountId: toId,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        setSuccess(true);
        setAmount("");
        setReference("");
        setNotes("");
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } catch (e) {
        setError(isStaleServerActionError(e) ? STALE_ACTION_MESSAGE : e instanceof Error ? e.message : "Transfer failed");
      }
    });
  }

  if (banks.length < 2) {
    return (
      <div className="card p-5 text-[13px] text-[var(--color-ink-400)]">
        Add at least two accounts (e.g. Petty Cash, Main Bank Account, M-Pesa Till) to transfer between them.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block">
        <span className={labelCls}>From</span>
        <select value={fromId} onChange={(e) => setFromId(Number(e.target.value))} className={input}>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>To</span>
        <select value={toId} onChange={(e) => setToId(Number(e.target.value))} className={input}>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>Amount (KES)</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>Reference (optional)</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. till float top-up" className={input} />
      </label>
      <label className="block">
        <span className={labelCls}>Notes (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </label>

      {error && (
        <div className="col-span-2 text-[12.5px] text-[var(--color-bad)] bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2">
          {error}
          {error === STALE_ACTION_MESSAGE && (
            <button type="button" onClick={() => window.location.reload()} className="underline font-medium shrink-0">Refresh</button>
          )}
        </div>
      )}
      {success && (
        <div className="col-span-2 text-[12.5px] text-[var(--color-good)] bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          Transfer posted.
        </div>
      )}

      <div className="col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2"
        >
          {pending ? "Transferring…" : "Transfer"}
        </button>
      </div>
    </form>
  );
}
