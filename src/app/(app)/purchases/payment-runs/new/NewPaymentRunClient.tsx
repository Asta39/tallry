"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES, todayISO } from "@/lib/money";
import { createPaymentRunAction } from "@/lib/payment-runs";

type Bill = {
  id: number;
  number: string;
  date: string;
  dueDate: string | null;
  vendorName: string | null;
  balanceCents: number;
};

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function NewPaymentRunClient({ bills, banks }: { bills: Bill[]; banks: { id: number; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<number, number>>({}); // billId -> amountCents
  const [date, setDate] = useState(todayISO());
  const [bankAccountId, setBankAccountId] = useState<number | "">(banks[0]?.id ?? "");
  const [method, setMethod] = useState("bank");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (bill: Bill) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (bill.id in next) delete next[bill.id];
      else next[bill.id] = bill.balanceCents;
      return next;
    });
  };

  const updateAmount = (billId: number, cents: number) => {
    setSelected((prev) => ({ ...prev, [billId]: cents }));
  };

  const total = useMemo(() => Object.values(selected).reduce((s, v) => s + v, 0), [selected]);
  const selectedCount = Object.keys(selected).length;

  const handleSubmit = () => {
    setError(null);
    if (selectedCount === 0) return setError("Select at least one bill");
    if (!bankAccountId) return setError("Choose a bank account");
    startTransition(async () => {
      try {
        const res = await createPaymentRunAction({
          date,
          bankAccountId: Number(bankAccountId),
          method,
          items: Object.entries(selected).map(([billId, amountCents]) => ({ billId: Number(billId), amountCents })),
        });
        router.push(`/purchases/payment-runs/${res.id}`);
      } catch (e: any) {
        setError(e.message || "Could not create payment run");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <label>
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls + " mt-1 block"} />
        </label>
        <label>
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Pay from</span>
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value ? Number(e.target.value) : "")} className={inputCls + " mt-1 block"}>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label>
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls + " mt-1 block"}>
            <option value="bank">Bank transfer</option>
            <option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <div className="ml-auto text-right">
          <div className="text-[11.5px] text-[var(--color-ink-400)]">{selectedCount} bill{selectedCount === 1 ? "" : "s"} selected</div>
          <div className="text-[18px] font-semibold tnum">{fmtKES(total)}</div>
        </div>
      </div>

      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="w-10 px-4 py-2.5" />
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Bill</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Vendor</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Due</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Balance</th>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide text-right">Pay amount</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => {
              const isSelected = b.id in selected;
              return (
                <tr key={b.id} className="hairline-t">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={isSelected} onChange={() => toggle(b)} className="accent-[var(--color-accent-500)]" />
                  </td>
                  <td className="px-3 py-2.5 text-[13px] font-medium">{b.number}</td>
                  <td className="px-3 py-2.5 text-[13px]">{b.vendorName || "—"}</td>
                  <td className="px-3 py-2.5 text-[13px] text-[var(--color-ink-400)]">{b.dueDate || b.date}</td>
                  <td className="px-3 py-2.5 text-[13px] text-right tnum">{fmtKES(b.balanceCents)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isSelected ? (
                      <input
                        type="number"
                        step="0.01"
                        className={inputCls + " w-28 text-right"}
                        value={(selected[b.id] / 100).toFixed(2)}
                        onChange={(e) => updateAmount(b.id, Math.round(parseFloat(e.target.value || "0") * 100))}
                      />
                    ) : (
                      <span className="text-[var(--color-ink-300)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {bills.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No open bills to pay.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSubmit}
        disabled={pending || selectedCount === 0}
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13.5px] font-medium px-5 py-2.5 transition-colors"
      >
        {pending ? "Creating…" : `Create draft run · ${fmtKES(total)}`}
      </button>
    </div>
  );
}
