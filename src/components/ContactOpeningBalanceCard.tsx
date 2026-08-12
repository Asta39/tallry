"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { fmtKES, todayISO } from "@/lib/money";
import { setContactOpeningBalanceAction, payContactOpeningBalanceAction } from "@/lib/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function ContactOpeningBalanceCard({
  contactId,
  displayName,
  isPayable,
  openingBalanceCents,
  openingBalanceDate,
  bankAccounts = [],
}: {
  contactId: number;
  displayName: string;
  isPayable: boolean;
  openingBalanceCents: number;
  openingBalanceDate: string | null;
  bankAccounts?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState((openingBalanceCents / 100).toFixed(2));
  const [date, setDate] = useState(openingBalanceDate || todayISO());
  const [memo, setMemo] = useState(`Balance brought forward for ${displayName}`);

  const [payOpen, setPayOpen] = useState(false);
  const [payPending, startPayTransition] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("mpesa");
  const [payBankAccountId, setPayBankAccountId] = useState<number | "">(bankAccounts[0]?.id ?? "");
  const [payReference, setPayReference] = useState("");

  function openEditor() {
    setError(null);
    setAmount((openingBalanceCents / 100).toFixed(2));
    setDate(openingBalanceDate || todayISO());
    setOpen(true);
  }

  function closeEditor() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function openPayEditor() {
    setPayError(null);
    setPayAmount((openingBalanceCents / 100).toFixed(2));
    setPayDate(todayISO());
    setPayReference("");
    setPayOpen(true);
  }

  function closePayEditor() {
    if (payPending) return;
    setPayOpen(false);
    setPayError(null);
  }

  return (
    <>
      <div className="card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12.5px] text-[var(--color-ink-600)]">Balance brought forward</div>
            <div className="money-lg mt-1">{fmtKES(openingBalanceCents)}</div>
            <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">
              {openingBalanceDate ? `As of ${openingBalanceDate}` : "Not set — import from a previous system if this contact carries a balance"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={openEditor}
              className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[12px] font-medium px-3 py-1.5"
            >
              {openingBalanceCents !== 0 ? "Edit" : "Set balance"}
            </button>
            {openingBalanceCents > 0 && (
              <button
                type="button"
                onClick={openPayEditor}
                className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[12px] font-medium px-3 py-1.5"
              >
                Record payment
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={open}
        onClose={closeEditor}
        title={`Balance brought forward · ${displayName}`}
        busy={pending}
        maxWidthClass="max-w-md"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await setContactOpeningBalanceAction({
                  contactId,
                  openingBalanceCents: Math.round((Number(amount || "0") || 0) * 100),
                  openingBalanceDate: date,
                  memo,
                });
                closeEditor();
                router.refresh();
              } catch (err: any) {
                setError(err?.message || "Could not update the brought-forward balance");
              }
            });
          }}
        >
          <p className="text-[12.5px] text-[var(--color-ink-500)]">
            Imports {displayName}&apos;s outstanding balance from a previous system as a single opening entry, dated as of the day you choose. Posts against
            &quot;Opening Balance Adjustments&quot; — never against sales or revenue — so it never affects this period&apos;s P&amp;L, and immediately appears on
            {isPayable ? " your payables" : " their statement and receivables"} balance.
          </p>

          <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2 text-[12.5px] text-[var(--color-ink-600)]">
            Current: <span className="font-medium text-[var(--color-ink-900)]">{fmtKES(openingBalanceCents)}</span>
            {openingBalanceDate ? ` as of ${openingBalanceDate}` : ""}
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
              {isPayable ? "Amount you owe them" : "Amount they owe you"}
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">As of date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputCls + " mt-1"}
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Memo</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder={`Balance brought forward for ${displayName}`}
            />
          </label>

          <div className="text-[12px] text-[var(--color-ink-400)]">
            Set the amount to `0.00` to clear it. Editing later reverses the old entry and posts a new one — nothing is silently overwritten in the ledger.
          </div>

          {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={closeEditor} className="text-[13px] text-[var(--color-ink-500)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payOpen}
        onClose={closePayEditor}
        title={`Record payment · ${displayName}`}
        busy={payPending}
        maxWidthClass="max-w-md"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPayError(null);
            startPayTransition(async () => {
              try {
                await payContactOpeningBalanceAction({
                  contactId,
                  amountCents: Math.round((Number(payAmount || "0") || 0) * 100),
                  date: payDate,
                  method: payMethod,
                  bankAccountId: payBankAccountId === "" ? null : payBankAccountId,
                  reference: payReference || undefined,
                });
                closePayEditor();
                router.refresh();
              } catch (err: any) {
                setPayError(err?.message || "Could not record the payment");
              }
            });
          }}
        >
          <p className="text-[12.5px] text-[var(--color-ink-500)]">
            {isPayable
              ? `Pays down what's still owed on ${displayName}'s brought-forward balance — partially or in full. Posts DR Accounts Payable · CR the account below, and reduces the tracked balance by exactly this amount.`
              : `Records ${displayName} paying down their brought-forward balance — partially or in full. Posts DR the account below · CR Accounts Receivable, and reduces the tracked balance by exactly this amount.`}
          </p>

          <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2 text-[12.5px] text-[var(--color-ink-600)]">
            Remaining: <span className="font-medium text-[var(--color-ink-900)]">{fmtKES(openingBalanceCents)}</span>
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount</span>
            <input
              type="number"
              step="0.01"
              max={(openingBalanceCents / 100).toFixed(2)}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inputCls + " mt-1"} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Method</span>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputCls + " mt-1"}>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
                <option value="kopokopo">Kopo Kopo</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Account</span>
              <select
                value={payBankAccountId}
                onChange={(e) => setPayBankAccountId(e.target.value ? Number(e.target.value) : "")}
                className={inputCls + " mt-1"}
              >
                <option value="">Undeposited funds</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reference</span>
            <input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder="M-Pesa code, cheque no., etc. (optional)"
            />
          </label>

          {payError && <p className="text-[12.5px] text-[var(--color-bad)]">{payError}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={payPending}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {payPending ? "Recording…" : "Record payment"}
            </button>
            <button type="button" onClick={closePayEditor} className="text-[13px] text-[var(--color-ink-500)] hover:underline">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
