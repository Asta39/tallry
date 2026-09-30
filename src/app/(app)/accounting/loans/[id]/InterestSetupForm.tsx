"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupExternalLoanInterestAction } from "../actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, parseKES } from "@/lib/money";

/** For a loan registered without interest: add the total interest and the
 *  term, so the outstanding includes it and it's expensed month by month. */
export function InterestSetupForm({
  loanId,
  principalCents,
  interestAccounts,
  defaultInterestAccountId,
}: {
  loanId: number;
  principalCents: number;
  interestAccounts: { id: number; code: string; name: string }[];
  defaultInterestAccountId: number | null;
}) {
  const router = useRouter();
  const [interest, setInterest] = useState("");
  const [term, setTerm] = useState("");
  const [accountId, setAccountId] = useState(defaultInterestAccountId ? String(defaultInterestAccountId) : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const interestCents = interest.trim() ? parseKES(interest) : 0;
  const months = Number(term);
  const monthly = interestCents > 0 && Number.isInteger(months) && months > 0 ? Math.ceil((principalCents + interestCents) / months) : null;

  async function submit() {
    setError(null);
    if (!interestCents || interestCents <= 0) return setError("Enter the total interest");
    if (!Number.isInteger(months) || months <= 0) return setError("Enter the term in months");
    setLoading(true);
    const res = await setupExternalLoanInterestAction({
      loanId,
      interestTotalCents: interestCents,
      termMonths: months,
      interestAccountId: accountId ? Number(accountId) : null,
    });
    setLoading(false);
    if (res?.error) return setError(res.error);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";
  const labelCls = "block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1";

  return (
    <div className="card px-5 py-4">
      <p className="text-[13px] font-semibold">Add interest &amp; term</p>
      <p className="text-[12.5px] text-[var(--color-ink-500)] mt-1">
        Total interest the lender charges over the loan. It&apos;s added to the outstanding balance and expensed evenly each
        month. Leave this if the loan is interest-free (e.g. a director loan).
      </p>
      <form action={submit} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <label className={labelCls}>Total interest (KSh)</label>
          <input className={inputCls} inputMode="decimal" placeholder="0.00" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Term (months)</label>
          <input className={inputCls} inputMode="numeric" placeholder="e.g. 12" value={term} onChange={(e) => setTerm(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Interest expense account</label>
          <select className={inputCls} value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">Select…</option>
            {interestAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3 flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-[var(--color-ink-500)]">
            {monthly ? <>Total repayable {fmtKES(principalCents + interestCents)} · about {fmtKES(monthly)}/month</> : null}
          </span>
          <PrimaryButton type="submit" disabled={loading}>{loading ? "Saving…" : "Add interest"}</PrimaryButton>
        </div>
      </form>
      {error && <p className="text-[12px] text-[var(--color-bad)] mt-2">{error}</p>}
    </div>
  );
}
