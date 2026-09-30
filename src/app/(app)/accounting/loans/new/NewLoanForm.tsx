"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExternalLoanAction } from "../actions";
import { PrimaryButton } from "@/components/ui";
import { parseKES, todayISO } from "@/lib/money";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(fd: FormData) {
    setError(null);
    const principalCents = parseKES(String(fd.get("amount") || ""));
    if (!principalCents || principalCents <= 0) return setError("Enter the amount borrowed");
    const rateRaw = String(fd.get("rate") || "").trim();
    setLoading(true);
    const res = await createExternalLoanAction({
      lender: String(fd.get("lender") || ""),
      reference: String(fd.get("reference") || ""),
      liabilityAccountId: Number(fd.get("liabilityAccountId")),
      interestAccountId: fd.get("interestAccountId") ? Number(fd.get("interestAccountId")) : null,
      principalCents,
      startDate: String(fd.get("startDate") || ""),
      receivedInto,
      interestRatePct: rateRaw ? Number(rateRaw) : null,
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
        <input name="amount" required inputMode="decimal" className={inputCls} placeholder="0.00" />
        <p className={hintCls}>If it was already partly repaid before today, enter what&apos;s still owed.</p>
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
        <label className={labelCls}>Interest rate (% p.a., optional)</label>
        <input name="rate" inputMode="decimal" className={inputCls} placeholder="e.g. 14" />
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
