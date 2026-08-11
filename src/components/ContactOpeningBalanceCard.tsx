"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { fmtKES, todayISO } from "@/lib/money";
import { setContactOpeningBalanceAction } from "@/lib/actions";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function ContactOpeningBalanceCard({
  contactId,
  displayName,
  isPayable,
  openingBalanceCents,
  openingBalanceDate,
}: {
  contactId: number;
  displayName: string;
  isPayable: boolean;
  openingBalanceCents: number;
  openingBalanceDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState((openingBalanceCents / 100).toFixed(2));
  const [date, setDate] = useState(openingBalanceDate || todayISO());
  const [memo, setMemo] = useState(`Balance brought forward for ${displayName}`);

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
          <button
            type="button"
            onClick={openEditor}
            className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[12px] font-medium px-3 py-1.5"
          >
            {openingBalanceCents !== 0 ? "Edit" : "Set balance"}
          </button>
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
    </>
  );
}
