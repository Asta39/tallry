"use client";

import { useState, useRef } from "react";
import { postPayrollRunAction } from "../actions";
import { PrimaryButton } from "@/components/ui";

export function PostRunForm({ runId, expenseAccounts, liabilityAccounts }: { runId: number, expenseAccounts: any[], liabilityAccounts: any[] }) {
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function handlePost(formData: FormData) {
    setLoading(true);
    try {
      await postPayrollRunAction(runId, formData);
      dialogRef.current?.close();
    } catch (e: any) {
      alert("Failed to post: " + e.message);
      setLoading(false);
    }
  }

  return (
    <>
      <PrimaryButton onClick={() => dialogRef.current?.showModal()}>
        Post to Ledger
      </PrimaryButton>
      
      <dialog ref={dialogRef} className="modal">
        <div className="modal-box p-6 bg-white rounded-xl shadow-xl max-w-md border border-[var(--color-ink-100)]">
          <h3 className="font-semibold text-[15px] mb-4 text-[var(--color-ink-900)]">Post Payroll Journal</h3>
          <p className="text-[13px] text-[var(--color-ink-500)] mb-6">
            Map the payroll totals to your ledger accounts. This action will create a locked journal entry.
          </p>
          <form action={handlePost} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Salary Expense Account (Debit)</label>
              <select name="expenseAccountId" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required>
                <option value="">Select an account...</option>
                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Net Salary Payable (Credit)</label>
              <select name="payablesAccountId" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required>
                <option value="">Select an account...</option>
                {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Tax & Statutory Liabilities (Credit)</label>
              <select name="taxLiabilitiesAccountId" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required>
                <option value="">Select an account...</option>
                {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
            
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
                {loading ? "Posting..." : "Confirm & Post"}
              </PrimaryButton>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
}
