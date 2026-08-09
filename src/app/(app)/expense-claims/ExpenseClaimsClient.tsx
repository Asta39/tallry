"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fmtKES, todayISO } from "@/lib/money";
import {
  submitExpenseClaimAction,
  approveExpenseClaimAction,
  rejectExpenseClaimAction,
  payExpenseClaimAction,
  payExpenseClaimGatewayAction,
} from "@/lib/expense-claims";
import { scanReceiptAction, getReceiptViewUrlAction, type ScannedReceiptFields } from "@/lib/receipts/scan";
import { parseKES } from "@/lib/money";
import { useRealtimeTable } from "@/lib/realtime/useRealtimeTable";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  payoutPhone: string | null;
  receiptUrl: string | null;
};

// Raw Postgres Realtime payload shape — column names, not the camelCase
// Drizzle field names the rest of this file uses.
type RawClaimRow = {
  id: number;
  org_id: number;
  member_id: number | null;
  date: string;
  description: string;
  amount_cents: number;
  status: string;
  submitted_by_name: string;
  reviewed_by_name: string | null;
  review_note: string | null;
  category_account_id: number;
  payout_phone: string | null;
  receipt_url: string | null;
};

function toClaim(row: RawClaimRow): Claim {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amountCents: row.amount_cents,
    status: row.status,
    submittedByName: row.submitted_by_name,
    reviewedByName: row.reviewed_by_name,
    reviewNote: row.review_note,
    categoryAccountId: row.category_account_id,
    payoutPhone: row.payout_phone,
    receiptUrl: row.receipt_url,
  };
}

function ViewReceiptLink({ receiptUrl }: { receiptUrl: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!receiptUrl) return null;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          setError(null);
          const res = await getReceiptViewUrlAction(receiptUrl);
          if (typeof res === "string") window.open(res, "_blank");
          else setError(res.error);
        })
      }
      className="text-[11.5px] text-[var(--color-accent-600)] hover:underline disabled:opacity-60"
    >
      {pending ? "Opening…" : "View receipt"}
      {error && <span className="block text-[var(--color-bad)]">{error}</span>}
    </button>
  );
}

function upsert(list: Claim[], claim: Claim): Claim[] {
  return list.some((c) => c.id === claim.id) ? list.map((c) => (c.id === claim.id ? claim : c)) : [claim, ...list];
}

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

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedReceiptFields | null>(null);

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);
    setScanned(null);
    setReceiptPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await scanReceiptAction(base64, file.type);
      if ("error" in res) {
        setScanError(res.error);
        return;
      }
      setReceiptPath(res.receiptPath);
      setScanned(res.fields);
      // Prefill — the claimant sees exactly what the model found and can
      // correct any of it before submitting; nothing here is locked.
      if (res.fields.date) setDate(res.fields.date);
      if (res.fields.description) setDescription(res.fields.description);
      if (res.fields.totalCents) setAmount((res.fields.totalCents / 100).toFixed(2));
    } catch (e: any) {
      setScanError(e?.message || "Could not scan this receipt");
    } finally {
      setScanning(false);
    }
  }

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
          payoutPhone: String(fd.get("payoutPhone") || "") || undefined,
          receiptUrl: receiptPath || undefined,
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

      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
          Photograph the receipt <span className="font-normal text-[var(--color-ink-400)]">(optional — auto-fills the fields below)</span>
        </span>
        <div className="mt-1 flex items-center gap-3">
          {receiptPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receiptPreview} alt="Receipt preview" className="h-14 w-14 rounded-lg object-cover border border-[var(--color-ink-200)]" />
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="text-[12.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-ink-100)] file:px-3 file:py-1.5 file:text-[12.5px] file:font-medium"
          />
        </div>
        {scanning && <div className="mt-1 text-[12px] text-[var(--color-ink-400)]">Reading receipt…</div>}
        {scanError && <div className="mt-1 text-[12px] text-[var(--color-bad)]">{scanError}</div>}
        {scanned && !scanning && (scanned.totalCents || scanned.vendorName) && (
          <div className="mt-1 text-[12px] text-[var(--color-good)]">
            Filled in from the receipt{scanned.vendorName ? ` (${scanned.vendorName})` : ""} — check the fields below before submitting.
          </div>
        )}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls + " mt-1"} required />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Category <span className="text-[var(--color-bad)]">*</span></span>
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
        <input type="text" name="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Fuel for client visit, Nairobi–Nakuru" className={inputCls + " mt-1"} required />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KES)</span>
          <input type="number" name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0.01" placeholder="0.00" className={inputCls + " mt-1"} required />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">M-Pesa number to reimburse to <span className="text-[var(--color-bad)]">*</span></span>
          <input type="tel" name="payoutPhone" placeholder="2547…" className={inputCls + " mt-1"} required />
        </label>
      </div>
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
                <ViewReceiptLink receiptUrl={c.receiptUrl} />
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

function PayButton({
  id,
  amountCents,
  payoutPhone,
  banks,
  gateways,
}: {
  id: number;
  amountCents: number;
  payoutPhone: string | null;
  banks: { id: number; name: string; kind?: string }[];
  gateways: { id: string; name: string }[];
}) {
  const [mode, setMode] = useState<"closed" | "bank" | "gateway">("closed");
  // Defaulting to banks[0] regardless of what the reimbursement actually
  // went out as meant "Pay from bank" could record the movement against
  // e.g. Main Bank Account while the money was really sent via M-Pesa (or,
  // just as often, not sent anywhere — see the warning below) — the M-Pesa
  // ledger then never shows the change the accountant expects to see.
  const [bankId, setBankId] = useState(() => banks.find((b) => b.kind === "mpesa")?.id ?? banks[0]?.id);
  const [gwId, setGwId] = useState(gateways[0]?.id ?? "");
  const [gwDestType, setGwDestType] = useState<"phone" | "till" | "paybill">("phone");
  // The claimant's own submitted number, if they gave one — pre-filled but
  // still editable, so paying to a different number is always possible.
  const [gwDest, setGwDest] = useState(payoutPhone || "");
  const [gwAccountNo, setGwAccountNo] = useState("");
  const [gwAmount, setGwAmount] = useState((amountCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (mode === "closed") {
    if (banks.length === 0 && gateways.length === 0) {
      return <span className="text-[11px] text-[var(--color-ink-400)]">No bank accounts or gateways</span>;
    }
    return (
      <div className="flex items-center justify-end gap-2">
        {banks.length > 0 && (
          <button onClick={() => setMode("bank")} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline" title="Records a payment already made elsewhere — sends no money">Record as paid</button>
        )}
        {gateways.length > 0 && (
          <button onClick={() => setMode("gateway")} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline" title="Actually sends money via M-Pesa/Kopo Kopo">Pay via gateway</button>
        )}
      </div>
    );
  }

  if (mode === "bank") {
    return (
      <div className="flex flex-col items-end gap-1 py-1">
        <div className="flex items-center gap-1.5">
          <select value={bankId} onChange={(e) => setBankId(Number(e.target.value))} className="rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]">
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button
            disabled={pending}
            onClick={() => {
              if (!window.confirm("This only RECORDS the reimbursement in the books — it does not send any money. Only confirm if you've already paid this person outside the app (cash, manual M-Pesa, etc). To actually send money, use \"Pay via gateway\" instead.")) return;
              startTransition(async () => { await payExpenseClaimAction(id, bankId!); window.location.reload(); });
            }}
            className="text-[11.5px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
          >
            Confirm
          </button>
          <button onClick={() => setMode("closed")} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
        </div>
        <span className="text-[10.5px] text-[var(--color-ink-400)] max-w-[220px] text-right">
          Only records a payment already made elsewhere — sends no money.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 py-1.5">
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {gateways.length > 1 && (
          <select value={gwId} onChange={(e) => setGwId(e.target.value)} className="rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]">
            {gateways.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <select value={gwDestType} onChange={(e) => setGwDestType(e.target.value as any)} className="rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]">
          <option value="phone">Mobile number</option>
          <option value="till">Till</option>
          <option value="paybill">Paybill</option>
        </select>
        <input
          value={gwDest}
          onChange={(e) => setGwDest(e.target.value)}
          placeholder={gwDestType === "phone" ? "2547…" : "Till/paybill no."}
          className="w-28 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
        />
        {gwDestType === "paybill" && (
          <input
            value={gwAccountNo}
            onChange={(e) => setGwAccountNo(e.target.value)}
            placeholder="Account no."
            className="w-24 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
          />
        )}
        <input
          value={gwAmount}
          onChange={(e) => setGwAmount(e.target.value)}
          placeholder="Amount"
          className="w-20 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
        />
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const amt = parseKES(gwAmount);
              if (!amt || amt <= 0) { setError("Enter a valid amount"); return; }
              if (!gwDest.trim()) { setError("Enter a destination"); return; }
              if (!gwId) { setError("No gateway selected"); return; }
              if (!confirm("Send this payout now? Real money will be moved immediately.")) return;
              try {
                const res = await payExpenseClaimGatewayAction(id, gwDest.trim(), gwDestType, amt, gwId, gwAccountNo.trim() || undefined);
                if (res?.error) { setError(res.error); return; }
                if (res?.requiresApproval) {
                  alert("This amount is over your payout limit — sent to the admin for approval. They can approve it from their phone or pay it themselves.");
                  window.location.reload();
                  return;
                }
                window.location.reload();
              } catch (e: any) {
                setError(e.message || "Payout failed");
              }
            })
          }
          className="text-[11.5px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
        >
          {pending ? "Sending…" : "Confirm payout"}
        </button>
        <button onClick={() => setMode("closed")} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
    </div>
  );
}

function ReviewSection({ pending, banks, isOwnerOrAdmin, awaitingIds }: { pending: Claim[]; banks: { id: number; name: string }[]; isOwnerOrAdmin: boolean; awaitingIds: number[] }) {
  const [, startTransition] = useTransition();
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const awaitingSet = new Set(awaitingIds);

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
                <ViewReceiptLink receiptUrl={c.receiptUrl} />
              </td>
              <td className="px-3 py-2.5 text-right font-medium tnum">{fmtKES(c.amountCents)}</td>
              <td className="px-5 py-2.5 text-right">
                {awaitingSet.has(c.id) && !isOwnerOrAdmin ? (
                  <span className="inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Waiting for admin approval
                  </span>
                ) : (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      disabled={approvingId === c.id}
                      onClick={() => {
                        setApprovingId(c.id);
                        setApproveError(null);
                        startTransition(async () => {
                          try {
                            await approveExpenseClaimAction(c.id);
                            window.location.reload();
                          } catch (e: any) {
                            setApproveError(e?.message || "Could not approve claim");
                            setApprovingId(null);
                          }
                        });
                      }}
                      className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
                    >
                      {approvingId === c.id ? "Approving…" : "Approve"}
                    </button>
                    <RejectButton id={c.id} />
                  </div>
                )}
              </td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing pending — all caught up.</td></tr>
          )}
        </tbody>
      </table>
      {approveError && <div className="px-5 py-3 text-[12.5px] text-[var(--color-bad)] hairline-t">{approveError}</div>}
    </div>
  );
}

function HistorySection({ reviewed, banks, gateways }: { reviewed: Claim[]; banks: { id: number; name: string; kind?: string }[]; gateways: { id: string; name: string }[] }) {
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
                <div className="text-[11px] text-[var(--color-ink-400)]">
                  {c.submittedByName}{c.payoutPhone ? ` · Reimburse to ${c.payoutPhone}` : ""}
                </div>
              </td>
              <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
              <td className="px-3 py-2.5 text-right font-medium tnum">{fmtKES(c.amountCents)}</td>
              <td className="px-5 py-2.5 text-right">
                {c.status === "approved" && <PayButton id={c.id} amountCents={c.amountCents} payoutPhone={c.payoutPhone} banks={banks} gateways={gateways} />}
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
  orgId,
  memberId,
  mine: initialMine,
  categoryAccounts,
  canReview,
  isOwnerOrAdmin,
  awaitingIds,
  pending: initialPending,
  reviewed: initialReviewed,
  banks,
  gateways,
}: {
  orgId: number;
  memberId: number | null;
  mine: Claim[];
  categoryAccounts: { id: number; code: string; name: string }[];
  canReview: boolean;
  isOwnerOrAdmin: boolean;
  awaitingIds: number[];
  pending: Claim[];
  reviewed: Claim[];
  banks: { id: number; name: string; kind?: string }[];
  gateways: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState(initialMine);
  const [pending, setPending] = useState(initialPending);
  const [reviewed, setReviewed] = useState(initialReviewed);

  // Full server resync — used whenever a realtime event can't be applied
  // with confidence (dropped/errored channel, or a shape we don't expect).
  const resync = useCallback(() => router.refresh(), [router]);

  useRealtimeTable<RawClaimRow>(
    "expense_claims",
    { column: "org_id", value: orgId },
    {
      onInsert: (row) => {
        const c = toClaim(row);
        const belongsToMe = memberId ? row.member_id === memberId : row.member_id === null;
        if (belongsToMe) setMine((prev) => upsert(prev, c));
        if (canReview && c.status === "pending") setPending((prev) => upsert(prev, c));
      },
      onUpdate: (row) => {
        const c = toClaim(row);
        const belongsToMe = memberId ? row.member_id === memberId : row.member_id === null;
        if (belongsToMe) setMine((prev) => upsert(prev, c));
        if (canReview) {
          setPending((prev) => (c.status === "pending" ? upsert(prev, c) : prev.filter((p) => p.id !== c.id)));
          setReviewed((prev) =>
            c.status === "approved" || c.status === "paid" ? upsert(prev, c) : prev.filter((p) => p.id !== c.id)
          );
        }
      },
      // Claims are never deleted in this app (rejected/paid are terminal
      // statuses, not row removals) — a DELETE event is unexpected, so
      // resync rather than guess what it means.
      onDelete: resync,
      onUnreliable: resync,
    }
  );

  return (
    <div className="space-y-6">
      <SubmitForm categoryAccounts={categoryAccounts} />
      {canReview && <ReviewSection pending={pending} banks={banks} isOwnerOrAdmin={isOwnerOrAdmin} awaitingIds={awaitingIds} />}
      {canReview && <HistorySection reviewed={reviewed} banks={banks} gateways={gateways} />}
      <MyClaimsTable claims={mine} />
    </div>
  );
}
