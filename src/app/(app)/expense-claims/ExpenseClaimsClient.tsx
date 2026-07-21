"use client";

import { useState, useTransition } from "react";
import { fmtKES, todayISO } from "@/lib/money";
import {
  submitExpenseClaimAction,
  approveExpenseClaimAction,
  rejectExpenseClaimAction,
  payExpenseClaimAction,
} from "@/lib/expense-claims";

type Claim = {
  id: number;
  date: string;
  description: string;
  amountCents: number;
  status: string;
  submittedByName: string;
  reviewedByName: string | null;
  reviewNote: string | null;
  categoryAccountId: number;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-sky-50 text-sky-700 border-sky-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${STATUS_STYLE[status] || "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]"}`}>
      {status}
    </span>
  );
}

function SubmitForm({ categoryAccounts }: { categoryAccounts: { id: number; code: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amountKes = parseFloat(String(fd.get("amount") || "0"));
    startTransition(async () => {
      try {
        await submitExpenseClaimAction({
          date: String(fd.get("date") || todayISO()),
          categoryAccountId: Number(fd.get("categoryAccountId")),
          description: String(fd.get("description") || ""),
          amountCents: Math.round(amountKes * 100),
        });
        setSuccess(true);
        form.reset();
        setTimeout(() => window.location.reload(), 800);
      } catch (e: any) {
        setError(e.message || "Could not submit claim");
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3">
      <h2 className="text-[14px] font-semibold">Submit a claim</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
          <input type="date" name="date" defaultValue={todayISO()} className={inputCls + " mt-1"} required />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Category</span>
          <select name="categoryAccountId" className={inputCls + " mt-1"} required defaultValue="">
            <option value="" disabled>Select an expense category…</option>
            {categoryAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Description</span>
        <input type="text" name="description" placeholder="e.g. Fuel for client visit, Nairobi–Nakuru" className={inputCls + " mt-1"} required />
      </label>
      <label className="block max-w-[200px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KES)</span>
        <input type="number" name="amount" step="0.01" min="0.01" placeholder="0.00" className={inputCls + " mt-1"} required />
      </label>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
          {pending ? "Submitting…" : "Submit claim"}
        </button>
        {error && <span className="text-[12.5px] text-[var(--color-bad)]">{error}</span>}
        {success && <span className="text-[12.5px] text-[var(--color-good)]">Submitted for approval.</span>}
      </div>
    </form>
  );
}

function MyClaimsTable({ claims }: { claims: Claim[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b">
        <h2 className="text-[14px] font-semibold">My claims</h2>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {claims.map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{c.date}</td>
              <td className="px-3 py-2.5">
                {c.description}
                {c.status === "rejected" && c.reviewNote && (
                  <div className="text-[11.5px] text-[var(--color-bad)] mt-0.5">Reason: {c.reviewNote}</div>
                )}
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
              <td className="px-5 py-2.5 text-right font-medium tnum">{fmtKES(c.amountCents)}</td>
            </tr>
          ))}
          {claims.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No claims yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RejectButton({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline">Reject</button>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason (optional)"
        className="w-32 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
      />
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await rejectExpenseClaimAction(id, note); window.location.reload(); })}
        className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
      >
        Confirm
      </button>
      <button onClick={() => setOpen(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
    </div>
  );
}

function PayButton({ id, banks }: { id: number; banks: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [bankId, setBankId] = useState(banks[0]?.id);
  const [pending, startTransition] = useTransition();

  if (banks.length === 0) return <span className="text-[11px] text-[var(--color-ink-400)]">No bank accounts</span>;
  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline">Pay</button>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))} className="rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]">
        {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await payExpenseClaimAction(id, bankId!); window.location.reload(); })}
        className="text-[11.5px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
      >
        Confirm
      </button>
      <button onClick={() => setOpen(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
    </div>
  );
}

function ReviewSection({ pending, banks }: { pending: Claim[]; banks: { id: number; name: string }[] }) {
  const [, startTransition] = useTransition();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b flex items-center gap-2.5">
        <h2 className="text-[14px] font-semibold">Pending review</h2>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 tnum">{pending.length}</span>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {pending.map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{c.date}</td>
              <td className="px-3 py-2.5">
                <div>{c.description}</div>
                <div className="text-[11px] text-[var(--color-ink-400)]">{c.submittedByName}</div>
              </td>
              <td className="px-3 py-2.5 text-right font-medium tnum">{fmtKES(c.amountCents)}</td>
              <td className="px-5 py-2.5 text-right">
                <div className="flex items-center justify-end gap-3">
                  <button
                    disabled={approvingId === c.id}
                    onClick={() => {
                      setApprovingId(c.id);
                      startTransition(async () => { await approveExpenseClaimAction(c.id); window.location.reload(); });
                    }}
                    className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
                  >
                    {approvingId === c.id ? "Approving…" : "Approve"}
                  </button>
                  <RejectButton id={c.id} />
                </div>
              </td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing pending — all caught up.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistorySection({ reviewed, banks }: { reviewed: Claim[]; banks: { id: number; name: string }[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b">
        <h2 className="text-[14px] font-semibold">Approved &amp; paid</h2>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {reviewed.map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{c.date}</td>
              <td className="px-3 py-2.5">
                <div>{c.description}</div>
                <div className="text-[11px] text-[var(--color-ink-400)]">{c.submittedByName}</div>
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
              <td className="px-3 py-2.5 text-right font-medium tnum">{fmtKES(c.amountCents)}</td>
              <td className="px-5 py-2.5 text-right">
                {c.status === "approved" && <PayButton id={c.id} banks={banks} />}
              </td>
            </tr>
          ))}
          {reviewed.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing here yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ExpenseClaimsClient({
  mine,
  categoryAccounts,
  canReview,
  pending,
  reviewed,
  banks,
}: {
  mine: Claim[];
  categoryAccounts: { id: number; code: string; name: string }[];
  canReview: boolean;
  pending: Claim[];
  reviewed: Claim[];
  banks: { id: number; name: string }[];
}) {
  return (
    <div className="space-y-6">
      <SubmitForm categoryAccounts={categoryAccounts} />
      {canReview && <ReviewSection pending={pending} banks={banks} />}
      {canReview && <HistorySection reviewed={reviewed} banks={banks} />}
      <MyClaimsTable claims={mine} />
    </div>
  );
}
