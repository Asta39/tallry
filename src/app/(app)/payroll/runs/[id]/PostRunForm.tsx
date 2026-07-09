"use client";

import { useState } from "react";
import { postPayrollRunAction } from "../actions";

export function PostRunForm({ runId, expenseAccounts, liabilityAccounts }: { runId: number, expenseAccounts: any[], liabilityAccounts: any[] }) {
  const [loading, setLoading] = useState(false);

  async function handlePost(formData: FormData) {
    if (!confirm("Are you sure you want to post this payroll run to the ledger? This cannot be undone.")) return;
    setLoading(true);
    try {
      await postPayrollRunAction(runId, formData);
    } catch (e: any) {
      alert("Failed to post: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-primary m-1">Post to Ledger</div>
      <div tabIndex={0} className="dropdown-content z-[1] menu p-4 shadow bg-base-100 rounded-box w-96 border border-base-content/10">
        <h3 className="font-semibold mb-4 text-lg">Post Payroll Journal</h3>
        <form action={handlePost} className="space-y-4">
          <div>
            <label className="label text-xs">Salary Expense Account (Debit)</label>
            <select name="expenseAccountId" className="select select-bordered select-sm w-full" required>
              <option value="">Select...</option>
              {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Net Salary Payable Account (Credit)</label>
            <select name="payablesAccountId" className="select select-bordered select-sm w-full" required>
              <option value="">Select...</option>
              {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Tax & Statutory Liabilities Account (Credit)</label>
            <select name="taxLiabilitiesAccountId" className="select select-bordered select-sm w-full" required>
              <option value="">Select...</option>
              {liabilityAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-sm btn-primary w-full mt-2" disabled={loading}>
            {loading ? "Posting..." : "Confirm & Post"}
          </button>
        </form>
      </div>
    </div>
  );
}
