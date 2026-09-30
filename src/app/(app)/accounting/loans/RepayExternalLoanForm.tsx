"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordExternalLoanRepaymentAction } from "./actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, parseKES, todayISO } from "@/lib/money";

export function RepayExternalLoanForm({
  loanId,
  lender,
  outstandingCents,
  suggestedCents,
  bankAccounts,
  compact = false,
}: {
  loanId: number;
  lender: string;
  outstandingCents: number;
  /** Pre-filled amount — the monthly installment when the loan has a term. */
  suggestedCents: number | null;
  bankAccounts: { id: number; name: string }[];
  /** Small outline trigger for use inside a table row. */
  compact?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initial = suggestedCents ? Math.min(suggestedCents, outstandingCents) : outstandingCents;
  const [amount, setAmount] = useState((initial / 100).toFixed(2));
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    const amountCents = parseKES(amount);
    if (!amountCents || amountCents <= 0) return setError("Enter the amount paid");
    setLoading(true);
    const res = await recordExternalLoanRepaymentAction({
      loanId,
      date,
      amountCents,
      bankAccountId: Number(bankAccountId),
      reference,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    setReference("");
    dialogRef.current?.close();
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";
  const labelCls = "block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1";

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="rounded-md border border-[var(--color-ink-200)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] whitespace-nowrap"
        >
          Record payment
        </button>
      ) : (
        <PrimaryButton type="button" onClick={() => dialogRef.current?.showModal()}>
          Record payment
        </PrimaryButton>
      )}

      <dialog
        ref={dialogRef}
        className="p-0 m-auto bg-transparent backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="p-6 bg-white rounded-xl shadow-xl w-[420px] max-w-[calc(100vw-32px)] border border-[var(--color-ink-100)] text-left whitespace-normal">
          <h3 className="font-semibold text-[15px] mb-1 text-[var(--color-ink-900)]">Loan payment · {lender}</h3>
          <p className="text-[12.5px] text-[var(--color-ink-500)] mb-5">
            Outstanding (including interest): <strong>{fmtKES(outstandingCents)}</strong>. The payment reduces this balance.
          </p>
          <form action={submit} className="space-y-3.5">
            <div>
              <label className={labelCls}>Amount paid (KSh)</label>
              <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Paid from</label>
                <select className={inputCls} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
                  <option value="">Select…</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date paid</label>
                <input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Reference (optional)</label>
              <input className={inputCls} placeholder="M-Pesa code, bank ref…" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-ink-100)]">
              <button
                type="button"
                className="px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] rounded-lg"
                onClick={() => dialogRef.current?.close()}
                disabled={loading}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Recording…" : "Record"}
              </PrimaryButton>
            </div>
            {error && <p className="text-[12px] text-[var(--color-bad)]">{error}</p>}
          </form>
        </div>
      </dialog>
    </>
  );
}
