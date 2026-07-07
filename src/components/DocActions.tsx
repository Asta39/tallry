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
  convertPoToBill,
} from "@/lib/actions";
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
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showPay, setShowPay] = useState(false);
  const [amount, setAmount] = useState(((doc.totalCents - doc.paidCents) / 100).toFixed(2));
  const [wht, setWht] = useState("0");
  const [method, setMethod] = useState("mpesa");
  const [bankId, setBankId] = useState<number | "">(bankAccounts[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
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
        {(doc.status === "draft" || (isQuote && doc.status === "open")) && (
          <button className={secondary} disabled={pending} onClick={() => router.push(`/sales/${isQuote ? "quotes" : "invoices"}/${doc.id}/edit`)}>
            Edit
          </button>
        )}
        {payable && (
          <button className={primary} disabled={pending} onClick={() => setShowPay((v) => !v)}>
            Record payment
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
        {doc.type === "purchase_order" && doc.status === "open" && (
          <button
            className={secondary}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const id = await convertPoToBill(doc.id);
                router.push(`/purchases/bills/${id}`);
              })
            }
          >
            Convert to bill →
          </button>
        )}
        {["invoice", "quote", "credit_note"].includes(doc.type) && doc.status !== "draft" && (
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
        {doc.status !== "void" && doc.status !== "draft" && (
          <button className={danger} disabled={pending} onClick={() => run(() => voidDoc(doc.id))}>
            Void
          </button>
        )}
      </div>

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
      {error && <div className="text-[13px] text-[var(--color-bad)]">{error}</div>}
    </div>
  );
}
