"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordExternalLoanRepaymentAction } from "./actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, parseKES, todayISO } from "@/lib/money";

type Opt = { id: number; name: string; code?: string };

export function RepayExternalLoanForm({
  loanId,
  lender,
  outstandingCents,
  bankAccounts,
  interestAccounts,
  defaultInterestAccountId,
  compact = false,
}: {
  loanId: number;
  lender: string;
  outstandingCents: number;
  bankAccounts: Opt[];
  interestAccounts: Opt[];
  defaultInterestAccountId: number | null;
  /** Small outline trigger for use inside a table row. */
  compact?: boolean;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [interestAccountId, setInterestAccountId] = useState(defaultInterestAccountId ? String(defaultInterestAccountId) : "");
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const principalCents = principal.trim() ? parseKES(principal) : 0;
  const interestCents = interest.trim() ? parseKES(interest) : 0;
  const totalCents = (principalCents > 0 ? principalCents : 0) + (interestCents > 0 ? interestCents : 0);

  async function submit() {
    setError(null);
    if (Number.isNaN(principalCents) || Number.isNaN(interestCents)) return setError("Enter valid amounts");
    if (principalCents < 0 || interestCents < 0) return setError("Amounts can't be negative");
    if (totalCents <= 0) return setError("Enter the principal and/or interest paid");
    setLoading(true);
    const res = await recordExternalLoanRepaymentAction({
      loanId,
      date,
      principalCents,
      interestCents,
      interestAccountId: interestCents > 0 && interestAccountId ? Number(interestAccountId) : null,
      bankAccountId: Number(bankAccountId),
      reference,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    setPrincipal("");
    setInterest("");
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
          Record repayment
        </button>
      ) : (
        <PrimaryButton type="button" onClick={() => dialogRef.current?.showModal()}>
          Record repayment
        </PrimaryButton>
      )}

      <dialog
        ref={dialogRef}
        className="p-0 m-auto bg-transparent backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="p-6 bg-white rounded-xl shadow-xl w-[440px] max-w-[calc(100vw-32px)] border border-[var(--color-ink-100)] text-left whitespace-normal">
          <h3 className="font-semibold text-[15px] mb-1 text-[var(--color-ink-900)]">Loan repayment · {lender}</h3>
          <p className="text-[12.5px] text-[var(--color-ink-500)] mb-5">
            Still owed: <strong>{fmtKES(outstandingCents)}</strong>. Split what you paid into principal (reduces the loan) and
            interest &amp; charges (an expense). Use your lender&apos;s statement for the split.
          </p>
          <form action={submit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Principal (KSh)</label>
                <input className={inputCls} inputMode="decimal" placeholder="0.00" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Interest &amp; charges (KSh)</label>
                <input className={inputCls} inputMode="decimal" placeholder="0.00" value={interest} onChange={(e) => setInterest(e.target.value)} />
              </div>
            </div>
            {interestCents > 0 && (
              <div>
                <label className={labelCls}>Interest expense account</label>
                <select className={inputCls} value={interestAccountId} onChange={(e) => setInterestAccountId(e.target.value)} required>
                  <option value="">Select…</option>
                  {interestAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ""}{a.name}</option>
                  ))}
                </select>
              </div>
            )}
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

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-ink-100)]">
              <span className="text-[12.5px] text-[var(--color-ink-500)]">
                Total paid <strong className="text-[var(--color-ink-900)] tnum">{fmtKES(totalCents)}</strong>
              </span>
              <div className="flex gap-2">
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
            </div>
            {error && <p className="text-[12px] text-[var(--color-bad)]">{error}</p>}
          </form>
        </div>
      </dialog>
    </>
  );
}
