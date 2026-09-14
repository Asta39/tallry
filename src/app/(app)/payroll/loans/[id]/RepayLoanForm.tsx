"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { recordLoanRepaymentAction } from "../actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, parseKES } from "@/lib/money";

export function RepayLoanForm({ loanId, bankAccounts, balanceCents }: { loanId: number; bankAccounts: { id: number; name: string }[]; balanceCents: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function handleRepay(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const bankAccountId = Number(formData.get("bankAccountId"));
      const amountCents = parseKES(amount);
      if (!amountCents || amountCents <= 0) throw new Error("Enter a valid amount");
      await recordLoanRepaymentAction(loanId, amountCents, bankAccountId);
      dialogRef.current?.close();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";

  return (
    <>
      <PrimaryButton onClick={() => dialogRef.current?.showModal()}>
        Record Repayment
      </PrimaryButton>

      <dialog
        ref={dialogRef}
        className="p-0 m-auto bg-transparent backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="p-6 bg-white rounded-xl shadow-xl max-w-md w-[400px] border border-[var(--color-ink-100)]">
          <h3 className="font-semibold text-[15px] mb-2 text-[var(--color-ink-900)]">Record Loan Repayment</h3>
          <p className="text-[13px] text-[var(--color-ink-500)] mb-6">
            For cash or M-Pesa paid back directly, outside payroll. Remaining balance: <strong>{fmtKES(balanceCents)}</strong>.
          </p>
          <form action={handleRepay} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Amount (KSh)</label>
              <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Received into</label>
              <select name="bankAccountId" className={inputCls} required>
                <option value="">Select an account...</option>
                {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {error && <p className="text-[12px] text-[var(--color-bad)]">{error}</p>}

            <div className="flex gap-2 justify-end pt-4 border-t border-[var(--color-ink-100)] mt-6">
              <button
                type="button"
                className="px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-600)] hover:bg-[var(--color-ink-50)] rounded-lg transition-colors"
                onClick={() => dialogRef.current?.close()}
                disabled={loading}
              >
                Cancel
              </button>
              <PrimaryButton type="submit" disabled={loading}>
                {loading ? "Recording..." : "Confirm"}
              </PrimaryButton>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
