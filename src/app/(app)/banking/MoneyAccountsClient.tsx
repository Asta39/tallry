"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { fmtKES, todayISO } from "@/lib/money";
import { setMoneyAccountOpeningBalanceAction } from "@/lib/actions";
import { createMoneyAccountAction } from "@/lib/chart-of-accounts";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

type MoneyAccount = {
  id: number;
  name: string;
  kind: string;
  balanceCents: number;
  openingBalanceCents: number;
  openingBalanceDate: string | null;
};

export function MoneyAccountsClient({ banks }: { banks: MoneyAccount[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<MoneyAccount | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [memo, setMemo] = useState("");

  const [addingAccount, setAddingAccount] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("mpesa");
  const [addPending, startAdd] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);

  const openingSummary = useMemo(() => {
    if (!selected) return null;
    return {
      current: fmtKES(selected.openingBalanceCents),
      date: selected.openingBalanceDate,
    };
  }, [selected]);

  function openEditor(bank: MoneyAccount) {
    setSelected(bank);
    setError(null);
    setAmount((bank.openingBalanceCents / 100).toFixed(2));
    setDate(bank.openingBalanceDate || todayISO());
    setMemo(`Opening balance for ${bank.name}`);
  }

  function closeEditor() {
    if (pending) return;
    setSelected(null);
    setError(null);
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => { setAddingAccount(true); setAddError(null); setNewName(""); setNewKind("mpesa"); }}
          className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[12.5px] font-medium px-3 py-1.5"
        >
          + New account
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {banks.map((b) => (
          <div key={b.id} className="card px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12.5px] text-[var(--color-ink-600)]">{b.name}</div>
                <div className="stat-figure money-lg mt-1">{fmtKES(b.balanceCents)}</div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-400)] mt-0.5">{b.kind}</div>
              </div>
              {["bank", "mpesa"].includes(b.kind) && (
                <button
                  type="button"
                  onClick={() => openEditor(b)}
                  className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[12px] font-medium px-3 py-1.5"
                >
                  Opening balance
                </button>
              )}
            </div>
            {["bank", "mpesa"].includes(b.kind) && (
              <div className="mt-4 rounded-lg bg-[var(--color-ink-50)] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-[var(--color-ink-400)]">Configured opening balance</div>
                <div className="mt-1 text-[13px] font-medium text-[var(--color-ink-800)]">
                  {b.openingBalanceCents !== 0 ? fmtKES(b.openingBalanceCents) : "Not set"}
                </div>
                <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">
                  {b.openingBalanceDate ? `Effective ${b.openingBalanceDate}` : "Set this once your historical starting balance is known."}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Modal
        open={!!selected}
        onClose={closeEditor}
        title={selected ? `Opening balance · ${selected.name}` : "Opening balance"}
        busy={pending}
        maxWidthClass="max-w-md"
      >
        {selected && (
          <form
            className="p-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              startTransition(async () => {
                try {
                  await setMoneyAccountOpeningBalanceAction({
                    bankAccountId: selected.id,
                    openingBalanceCents: Math.round((Number(amount || "0") || 0) * 100),
                    openingBalanceDate: date,
                    memo,
                  });
                  closeEditor();
                  router.refresh();
                } catch (err: any) {
                  setError(err?.message || "Could not update opening balance");
                }
              });
            }}
          >
            <p className="text-[12.5px] text-[var(--color-ink-500)]">
              This creates or replaces the tracked opening-balance journal entry for this money account, so the ledger and the banking register stay aligned.
            </p>

            <div className="rounded-lg bg-[var(--color-ink-50)] px-3 py-2 text-[12.5px] text-[var(--color-ink-600)]">
              Current opening balance: <span className="font-medium text-[var(--color-ink-900)]">{openingSummary?.current || "Not set"}</span>
              {openingSummary?.date ? ` on ${openingSummary.date}` : ""}
            </div>

            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Opening balance amount</span>
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
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Effective date</span>
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
                placeholder={`Opening balance for ${selected.name}`}
              />
            </label>

            <div className="text-[12px] text-[var(--color-ink-400)]">
              Set the amount to `0.00` to clear the configured opening balance.
            </div>

            {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
              >
                {pending ? "Saving…" : "Save opening balance"}
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="text-[13px] text-[var(--color-ink-500)] hover:underline"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={addingAccount}
        onClose={() => { if (!addPending) setAddingAccount(false); }}
        title="New money account"
        busy={addPending}
        maxWidthClass="max-w-md"
      >
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setAddError(null);
            if (!newName.trim()) return setAddError("Give the account a name");
            startAdd(async () => {
              try {
                await createMoneyAccountAction({ name: newName.trim(), kind: newKind as "bank" | "mpesa" | "cash" | "card" });
                setAddingAccount(false);
                router.refresh();
              } catch (err: any) {
                setAddError(err?.message || "Could not create account");
              }
            });
          }}
        >
          <p className="text-[12.5px] text-[var(--color-ink-500)]">
            Creates a new money account with its own ledger balance, separate from your existing accounts — e.g. a second M-Pesa number like Pochi la Biashara, kept distinct from your till.
          </p>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Account name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputCls + " mt-1"}
              placeholder="Pochi la Biashara"
            />
          </label>

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Type</span>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value)} className={inputCls + " mt-1"}>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </label>

          {addError && <p className="text-[12.5px] text-[var(--color-bad)]">{addError}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={addPending}
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
            >
              {addPending ? "Creating…" : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => setAddingAccount(false)}
              className="text-[13px] text-[var(--color-ink-500)] hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
