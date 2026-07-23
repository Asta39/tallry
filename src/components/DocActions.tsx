"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  issueDocument,
  voidDoc,
  markQuote,
  convertQuoteToInvoice,
  recordPayment,
  createCreditNoteFromInvoice,
  approveBillAction,
  rejectBillAction,
} from "@/lib/actions";
import { writeOffInvoice } from "@/lib/phase-a-actions";
import { convertPoToBill } from "@/lib/actions";
import { requestPaymentAction, payOutAction } from "@/lib/payments/actions";
import { fmtKES, parseKES, todayISO } from "@/lib/money";

const btn =
  "rounded-lg text-[13px] font-medium px-4 py-2 transition-colors disabled:opacity-50";
const primary = `${btn} bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white`;
const secondary = `${btn} border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)]`;
const danger = `${btn} text-[var(--color-bad)] hover:bg-red-50`;

export function DocActions({
  doc,
  bankAccounts,
  printHref,
  gateways,
  contactPhone,
  canApprove,
  poLines,
}: {
  doc: {
    id: number;
    type: string;
    status: string;
    totalCents: number;
    paidCents: number;
  };
  bankAccounts: { id: number; label: string }[];
  printHref?: string;
  gateways?: { id: string; name: string }[];
  contactPhone?: string;
  canApprove?: boolean;
  poLines?: { id: number; description: string; qty: number; billedQty: number }[];
}) {
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const gatewayConnected = gateways && gateways.length > 0;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState(((doc.totalCents - doc.paidCents) / 100).toFixed(2));
  const [wht, setWht] = useState("0");
  const [method, setMethod] = useState("mpesa");
  const [bankId, setBankId] = useState<number | "">(bankAccounts[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Gateway states
  const [showRequestPayment, setShowRequestPayment] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [gwId, setGwId] = useState(gateways?.[0]?.id || "");
  const [gwPhone, setGwPhone] = useState(contactPhone || "");
  const [gwAmount, setGwAmount] = useState(((doc.totalCents - doc.paidCents) / 100).toFixed(2));
  const [gwDestType, setGwDestType] = useState<"phone" | "till" | "paybill">("phone");
  const [gwAccountNo, setGwAccountNo] = useState("");

  // PO → bill conversion (partial receipt)
  const [showConvertPo, setShowConvertPo] = useState(false);
  const remainingPoLines = (poLines ?? []).map((l) => ({ ...l, remaining: l.qty - l.billedQty }));
  const [poQtys, setPoQtys] = useState<Record<number, string>>(() =>
    Object.fromEntries(remainingPoLines.map((l) => [l.id, String(l.remaining)]))
  );

  const run = (fn: () => Promise<any>) => {
    setError(null);
    start(async () => {
      try {
        const res = await fn();
        if (res && typeof res === "object" && "error" in res) {
          setError(res.error);
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  };

  const isQuote = doc.type === "quote";
  const payable =
    ["invoice", "bill"].includes(doc.type) && ["open", "partial"].includes(doc.status);

  const inputCls =
    "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {doc.status === "draft" && (
          <button className={primary} disabled={pending} onClick={() => run(() => issueDocument(doc.id))}>
            {isQuote ? "Mark as sent" : "Issue"}
          </button>
        )}
        {doc.type === "bill" && doc.status === "pending_approval" && canApprove && !showReject && (
          <>
            <button className={primary} disabled={pending} onClick={() => run(() => approveBillAction(doc.id))}>
              Approve &amp; post
            </button>
            <button className={danger} disabled={pending} onClick={() => setShowReject(true)}>
              Reject
            </button>
          </>
        )}
        {doc.type === "bill" && doc.status === "pending_approval" && !canApprove && (
          <span className="text-[13px] text-[var(--color-ink-500)]">Waiting for an accountant or admin to approve this bill.</span>
        )}
        {(
          (doc.type === "quote" && ["draft", "open"].includes(doc.status)) ||
          (doc.type === "invoice" && ["draft", "open", "partial"].includes(doc.status))
        ) && (
          <button className={secondary} disabled={pending} onClick={() => router.push(`/sales/${doc.type === "quote" ? "quotes" : "invoices"}/${doc.id}/edit`)}>
            Edit
          </button>
        )}
        {payable && (
          <button className={primary} disabled={pending} onClick={() => setShowPay((v) => !v)}>
            Record payment
          </button>
        )}
        {payable && doc.type === "invoice" && gatewayConnected && (
          <button className={primary} disabled={pending} onClick={() => setShowRequestPayment((v) => !v)}>
            Request via Gateway (STK)
          </button>
        )}
        {payable && ["bill", "expense"].includes(doc.type) && gatewayConnected && (
          <button className={primary} disabled={pending} onClick={() => setShowPayout((v) => !v)}>
            Pay via Gateway
          </button>
        )}
        {isQuote && doc.status === "open" && (
          <>
            <button className={secondary} disabled={pending} onClick={() => run(() => markQuote(doc.id, "accepted"))}>
              Accepted ✓
            </button>
            <button className={secondary} disabled={pending} onClick={() => run(() => markQuote(doc.id, "declined"))}>
              Declined
            </button>
          </>
        )}
        {isQuote && ["open", "accepted"].includes(doc.status) && (
          <button
            className={secondary}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const id = await convertQuoteToInvoice(doc.id);
                router.push(`/sales/invoices/${id}`);
              })
            }
          >
            Convert to invoice →
          </button>
        )}
        {doc.type === "invoice" && ["open", "partial", "paid"].includes(doc.status) && (
          <button
            className={secondary}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const id = await createCreditNoteFromInvoice(doc.id);
                router.push(`/sales/credit-notes/${id}`);
              })
            }
          >
            Create credit note
          </button>
        )}
        {doc.type === "invoice" && ["open", "partial"].includes(doc.status) && (
          <button
            className={danger}
            disabled={pending}
            onClick={() => {
              if (!confirm("Write off the unpaid balance as bad debt? This posts to the ledger and can't be undone here.")) return;
              run(() => writeOffInvoice(doc.id));
            }}
          >
            Write off
          </button>
        )}
        {doc.type === "purchase_order" && ["open", "partial"].includes(doc.status) && (
          <button className={secondary} disabled={pending} onClick={() => setShowConvertPo((v) => !v)}>
            Convert to bill →
          </button>
        )}
        {["invoice", "quote", "credit_note", "expense", "bill", "purchase_order"].includes(doc.type) && doc.status !== "draft" && (
          <>
            <a href={`/api/pdf/${doc.id}`} target="_blank" className={secondary}>
              View PDF
            </a>
            <a href={`/api/pdf/${doc.id}?download=1`} className={secondary}>
              Download PDF
            </a>
          </>
        )}
        {printHref && doc.status !== "draft" && (
          <a href={printHref} target="_blank" className={secondary}>
            Print
          </a>
        )}
        {doc.status !== "void" && doc.status !== "draft" && doc.status !== "pending_approval" && (
          <button className={danger} disabled={pending} onClick={() => run(() => voidDoc(doc.id))}>
            Void
          </button>
        )}
      </div>

      {showReject && (
        <div className="card p-4 flex flex-wrap items-end gap-3 border-red-200 bg-red-50/50">
          <label className="block flex-1 min-w-[240px]">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reason (shown to whoever submitted it)</span>
            <input
              className={inputCls + " w-full mt-1"}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Wrong vendor account, please fix and resubmit"
            />
          </label>
          <button
            className={danger}
            disabled={pending}
            onClick={() => run(async () => { await rejectBillAction(doc.id, rejectNote); setShowReject(false); })}
          >
            {pending ? "Rejecting…" : "Confirm rejection"}
          </button>
          <button className={secondary} disabled={pending} onClick={() => setShowReject(false)}>Cancel</button>
        </div>
      )}

      {showConvertPo && (
        <div className="card p-4 space-y-3">
          <p className="text-[12.5px] text-[var(--color-ink-600)]">
            Bill only part of an order by lowering a line's quantity below what's remaining — the rest stays open on this PO to bill later.
          </p>
          <div className="rounded-lg border border-[var(--color-ink-100)] overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead className="hairline-b">
                <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left px-3 py-2 font-semibold">Line</th>
                  <th className="text-right px-3 py-2 font-semibold">Remaining</th>
                  <th className="text-right px-3 py-2 font-semibold w-28">Bill now</th>
                </tr>
              </thead>
              <tbody>
                {remainingPoLines.map((l) => (
                  <tr key={l.id} className="hairline-t">
                    <td className="px-3 py-2 text-[13px]">{l.description}</td>
                    <td className="px-3 py-2 text-[13px] text-right tnum">{l.remaining}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className={inputCls + " w-full text-right"}
                        value={poQtys[l.id] ?? ""}
                        onChange={(e) => setPoQtys((q) => ({ ...q, [l.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button
              className={primary}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const lineQtys: Record<number, number> = {};
                  for (const l of remainingPoLines) {
                    lineQtys[l.id] = parseFloat(poQtys[l.id] ?? "0") || 0;
                  }
                  const id = await convertPoToBill(doc.id, lineQtys);
                  router.push(`/purchases/bills/${id}`);
                })
              }
            >
              {pending ? "Converting…" : "Create bill"}
            </button>
            <button className={secondary} disabled={pending} onClick={() => setShowConvertPo(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showPay && (
        <div className="card p-4 grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KSh)</span>
            <input className={inputCls + " w-full mt-1"} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          {doc.type === "invoice" && (
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">WHT withheld (KSh)</span>
              <input className={inputCls + " w-full mt-1"} value={wht} onChange={(e) => setWht(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Method</span>
            <select className={inputCls + " w-full mt-1"} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Into account</span>
            <select
              className={inputCls + " w-full mt-1"}
              value={bankId}
              onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : "")}
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reference</span>
            <input
              className={inputCls + " w-full mt-1"}
              placeholder="M-Pesa code…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <div className="col-span-full flex items-center gap-3">
            <button
              className={primary}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const amt = parseKES(amount);
                  const whtC = parseKES(wht) || 0;
                  if (!amt || amt <= 0) throw new Error("Enter a valid amount");
                  await recordPayment({
                    direction: doc.type === "invoice" ? "in" : "out",
                    documentId: doc.id,
                    date: todayISO(),
                    amountCents: amt,
                    whtCents: whtC,
                    method,
                    bankAccountId: bankId === "" ? null : bankId,
                    reference: reference || undefined,
                  });
                  setShowPay(false);
                })
              }
            >
              {pending ? "Saving…" : `Record ${fmtKES(parseKES(amount) || 0)}`}
            </button>
            <span className="text-[12px] text-[var(--color-ink-400)]">
              Balance due: {fmtKES(doc.totalCents - doc.paidCents)}
              {doc.type === "invoice" && " · If the customer withheld tax, enter the WHT amount — it counts as paid."}
            </span>
          </div>
        </div>
      )}

      {showRequestPayment && (
        <div className="card p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end border-[var(--color-accent-200)] bg-[var(--color-accent-50)]/50">
          {(gateways?.length || 0) > 1 && (
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Gateway</span>
              <select className={inputCls + " w-full mt-1"} value={gwId} onChange={(e) => setGwId(e.target.value)}>
                {gateways?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Customer Phone</span>
            <input className={inputCls + " w-full mt-1"} placeholder="2547..." value={gwPhone} onChange={(e) => setGwPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KSh)</span>
            <input className={inputCls + " w-full mt-1"} value={gwAmount} onChange={(e) => setGwAmount(e.target.value)} />
          </label>
          <div className="col-span-full flex items-center gap-3">
            <button
              className={primary}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const amt = parseKES(gwAmount);
                  if (!amt || amt <= 0) throw new Error("Enter a valid amount");
                  if (!gwPhone) throw new Error("Enter phone number");
                  if (!gwId) throw new Error("No gateway selected");
                  const res = await requestPaymentAction(doc.id, gwPhone, amt, gwId);
                  if (res && "error" in res && res.error) throw new Error(res.error);
                  setShowRequestPayment(false);
                  alert("Payment request sent to customer's phone!");
                })
              }
            >
              {pending ? "Sending…" : "Send STK Push"}
            </button>
          </div>
        </div>
      )}

      {showPayout && (
        <div className="card p-4 grid grid-cols-2 lg:grid-cols-4 gap-3 items-end border-[var(--color-accent-200)] bg-[var(--color-accent-50)]/50">
          {(gateways?.length || 0) > 1 && (
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Gateway</span>
              <select className={inputCls + " w-full mt-1"} value={gwId} onChange={(e) => setGwId(e.target.value)}>
                {gateways?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Destination Type</span>
            <select className={inputCls + " w-full mt-1"} value={gwDestType} onChange={(e) => setGwDestType(e.target.value as any)}>
              <option value="phone">Mobile Number (B2C)</option>
              <option value="till">Till Number (Buy Goods)</option>
              <option value="paybill">Paybill Number</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Destination (Phone/Till/Paybill)</span>
            <input className={inputCls + " w-full mt-1"} value={gwPhone} onChange={(e) => setGwPhone(e.target.value)} />
          </label>
          {gwDestType === "paybill" && (
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Account Number</span>
              <input className={inputCls + " w-full mt-1"} value={gwAccountNo} onChange={(e) => setGwAccountNo(e.target.value)} placeholder="Account at the paybill" />
            </label>
          )}
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KSh)</span>
            <input className={inputCls + " w-full mt-1"} value={gwAmount} onChange={(e) => setGwAmount(e.target.value)} />
          </label>
          <div className="col-span-full flex items-center gap-3">
            <button
              className={primary}
              disabled={pending}
              onClick={() =>
                run(async () => {
                  if (!confirm("Are you sure you want to send this payout? Real money will be moved immediately.")) return;
                  const amt = parseKES(gwAmount);
                  if (!amt || amt <= 0) throw new Error("Enter a valid amount");
                  if (!gwPhone) throw new Error("Enter destination");
                  if (!gwId) throw new Error("No gateway selected");
                  if (gwDestType === "paybill" && !gwAccountNo.trim()) throw new Error("Enter the account number for the paybill");
                  const res = await payOutAction(doc.id, gwPhone, gwDestType, amt, gwId, gwAccountNo.trim() || undefined);
                  if (res && "error" in res && res.error) throw new Error(res.error);
                  setShowPayout(false);
                  alert("Payout dispatched — it will be recorded once the gateway confirms the transfer.");
                })
              }
            >
              {pending ? "Processing…" : "Confirm Payout"}
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-[13px] text-[var(--color-bad)]">{error}</div>}
    </div>
  );
}
