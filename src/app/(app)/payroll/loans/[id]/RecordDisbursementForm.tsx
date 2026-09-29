"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordLoanDisbursementAction } from "../actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, todayISO } from "@/lib/money";

/**
 * Backfill for a loan/advance issued with "don't record the disbursement":
 * its recoveries already credited Receivables with no matching debit. The
 * accountant picks where the money actually came from.
 */
export function RecordDisbursementForm({
  loanId,
  principalCents,
  defaultDate,
  bankAccounts,
}: {
  loanId: number;
  principalCents: number;
  defaultDate: string;
  bankAccounts: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await recordLoanDisbursementAction(loanId, source, date);
    setLoading(false);
    if (res?.error) setError(res.error);
    else router.refresh();
  }

  const inputCls =
    "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
      <p className="text-[13px] font-semibold text-amber-900">Disbursement not recorded</p>
      <p className="text-[12.5px] text-amber-900/80 mt-1">
        This was issued without saying where the {fmtKES(principalCents)} came from, so it was never added to Accounts
        Receivable — but every repayment was taken off Receivables, which leaves them understated. Record where the money
        came from to correct it (the full amount, even if already repaid).
      </p>
      <form
        action={submit}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-amber-900/80">Paid out from</span>
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} required>
            <option value="">Select…</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
            <option value="brought_forward">Balance brought forward (owed from before using Zeno)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-amber-900/80">Date</span>
          <input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <PrimaryButton type="submit" disabled={loading || !source}>
          {loading ? "Recording…" : "Record disbursement"}
        </PrimaryButton>
      </form>
      {error && <p className="text-[12px] text-[var(--color-bad)] mt-2">{error}</p>}
    </div>
  );
}
