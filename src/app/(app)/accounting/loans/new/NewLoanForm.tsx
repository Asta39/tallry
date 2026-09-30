"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExternalLoanAction } from "../actions";
import { PrimaryButton } from "@/components/ui";
import { fmtKES, parseKES, todayISO } from "@/lib/money";

type Acc = { id: number; code: string; name: string };

export function NewLoanForm({
  liabilityAccounts,
  interestAccounts,
  bankAccounts,
  defaultLiabilityId,
  defaultInterestId,
}: {
  liabilityAccounts: Acc[];
  interestAccounts: Acc[];
  bankAccounts: { id: number; name: string }[];
  defaultLiabilityId: number | null;
  defaultInterestId: number | null;
}) {
  const router = useRouter();
  const [receivedInto, setReceivedInto] = useState("");
  const [amount, setAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [term, setTerm] = useState("");
  const [rate, setRate] = useState("");
  const principalCents = amount.trim() ? parseKES(amount) : 0;
  const interestCents = interest.trim() ? parseKES(interest) : 0;
  const months = Number(term);
  const termOk = Number.isInteger(months) && months > 0;
  // Flat-rate helper: principal × rate × months/12 — what most Kenyan lenders quote.
  const rateNum = Number(rate);
  const flatFromRate =
    principalCents > 0 && termOk && rate.trim() && Number.isFinite(rateNum) && rateNum > 0
      ? Math.round((principalCents * rateNum * months) / 1200)
      : null;
  const monthly = termOk && principalCents > 0 ? Math.ceil((principalCents + (interestCents > 0 ? interestCents : 0)) / months) : null;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(fd: FormData) {
    setError(null);
    if (!principalCents || principalCents <= 0) return setError("Enter the amount borrowed");
    if (Number.isNaN(interestCents) || interestCents < 0) return setError("Enter a valid interest amount");
    if (interestCents > 0 && !termOk) return setError("Enter the term in months to spread the interest over");
    setLoading(true);
    const res = await createExternalLoanAction({
      lender: String(fd.get("lender") || ""),
      reference: String(fd.get("reference") || ""),
      liabilityAccountId: Number(fd.get("liabilityAccountId")),
      interestAccountId: fd.get("interestAccountId") ? Number(fd.get("interestAccountId")) : null,
      principalCents,
      interestTotalCents: interestCents > 0 ? interestCents : 0,
      termMonths: termOk ? months : null,
      startDate: String(fd.get("startDate") || ""),
      receivedInto,
      interestRatePct: rate.trim() ? rateNum : null,
      notes: String(fd.get("notes") || ""),
    });
    setLoading(false);
    if (res.error) return setError(res.error);
    router.push(`/accounting/loans/${res.id}`);
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";
  const labelCls = "block text-[12px] font-medium text-[var(--color-ink-600)] mb-1";
  const hintCls = "text-[11px] text-[var(--color-ink-400)] mt-1";

  return (
    <form action={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className={labelCls}>Lender</label>
        <input name="lender" required className={inputCls} placeholder="e.g. KCB, Stima SACCO, M-Pesa Business Loan, a director" />
      </div>
      <div>
        <label className={labelCls}>Amount borrowed (KSh)</label>
        <input name="amount" required inputMode="decimal" className={inputCls} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className={hintCls}>Principal only. If it was already partly repaid before today, enter the principal still owed.</p>
      </div>
      <div>
        <label className={labelCls}>Date received</label>
        <input name="startDate" type="date" required defaultValue={todayISO()} max={todayISO()} className={inputCls} />
      </div>

      <div className="sm:col-span-2">
        <label className={labelCls}>Money received into</label>
        <select value={receivedInto} onChange={(e) => setReceivedInto(e.target.value)} required className={inputCls}>
          <option value="">Select…</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
          <option value="already_recorded">Already in the books (opening balance or a manual journal)</option>
        </select>
        <p className={hintCls}>
          {receivedInto === "already_recorded"
            ? "Nothing is posted — the loan is only registered here so you can record repayments against it. Use this for loans you already entered by hand."
            : "Posts the money in: debits this account, credits the loan account below."}
        </p>
      </div>

      <div>
        <label className={labelCls}>Loan account</label>
        <select name="liabilityAccountId" required defaultValue={defaultLiabilityId ?? ""} className={inputCls}>
          <option value="">Select…</option>
          {liabilityAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Interest expense account</label>
        <select name="interestAccountId" defaultValue={defaultInterestId ?? ""} className={inputCls}>
          <option value="">Select…</option>
          {interestAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>
        <p className={hintCls}>Default for the interest part of each repayment.</p>
      </div>

      <div>
        <label className={labelCls}>Term (months)</label>
        <input inputMode="numeric" className={inputCls} placeholder="e.g. 12" value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>Interest rate (% p.a. flat, optional)</label>
        <input inputMode="decimal" className={inputCls} placeholder="e.g. 14" value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Total interest over the loan (KSh)</label>
        <input inputMode="decimal" className={inputCls} placeholder="0.00 — leave blank if interest-free" value={interest} onChange={(e) => setInterest(e.target.value)} />
        <p className={hintCls}>
          Added to the outstanding balance and expensed evenly each month over the term.
          {flatFromRate != null && (
            <>
              {" "}At {rateNum}% flat that&apos;s {fmtKES(flatFromRate)} —{" "}
              <button type="button" className="text-[var(--color-accent-600)] hover:underline" onClick={() => setInterest((flatFromRate / 100).toFixed(2))}>
                use this
              </button>
              .
            </>
          )}
        </p>
        {monthly != null && (
          <p className="text-[12px] text-[var(--color-ink-600)] mt-1.5">
            Total repayable {fmtKES(principalCents + (interestCents > 0 ? interestCents : 0))} · about {fmtKES(monthly)}/month
          </p>
        )}
      </div>
      <div>
        <label className={labelCls}>Loan / account reference (optional)</label>
        <input name="reference" className={inputCls} placeholder="Loan account no." />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls}>Notes (optional)</label>
        <textarea name="notes" rows={2} className={inputCls + " resize-none"} placeholder="Term, repayment schedule, security…" />
      </div>

      {error && <p className="sm:col-span-2 text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      <div className="sm:col-span-2 flex justify-end">
        <PrimaryButton type="submit" disabled={loading}>{loading ? "Saving…" : "Record loan"}</PrimaryButton>
      </div>
    </form>
  );
}
