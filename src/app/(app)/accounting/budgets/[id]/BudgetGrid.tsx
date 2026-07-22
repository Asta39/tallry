"use client";

import { useMemo, useState, useTransition } from "react";
import { saveBudgetLinesAction } from "@/lib/budgets";

type Account = { id: number; code: string; name: string; type: string };
type Line = { accountId: number; month: string; amountCents: number };

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

export function BudgetGrid({ budgetId, fiscalYear, accounts, lines }: { budgetId: number; fiscalYear: string; accounts: Account[]; lines: Line[] }) {
  const initial = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lines) map.set(`${l.accountId}-${l.month}`, (l.amountCents / 100).toString());
    return map;
  }, [lines]);

  const [values, setValues] = useState<Map<string, string>>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const setCell = (accountId: number, month: string, value: string) => {
    setValues((prev) => {
      const next = new Map(prev);
      next.set(`${accountId}-${month}`, value);
      return next;
    });
  };

  const rowTotal = (accountId: number) =>
    MONTHS.reduce((s, m) => s + (parseFloat(values.get(`${accountId}-${m}`) || "0") || 0), 0);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    const payload: { accountId: number; month: string; amountCents: number }[] = [];
    for (const a of accounts) {
      for (const m of MONTHS) {
        const raw = values.get(`${a.id}-${m}`);
        const amount = raw ? Math.round(parseFloat(raw) * 100) : 0;
        payload.push({ accountId: a.id, month: `${fiscalYear}-${m}`, amountCents: amount || 0 });
      }
    }
    startTransition(async () => {
      try {
        await saveBudgetLinesAction(budgetId, payload);
        setSaved(true);
      } catch (e: any) {
        setError(e.message || "Could not save budget");
      }
    });
  };

  const income = accounts.filter((a) => a.type === "income");
  const expense = accounts.filter((a) => a.type === "expense");

  const Section = ({ title, rows }: { title: string; rows: Account[] }) => (
    <div className="mb-4">
      <h3 className="text-[12.5px] font-semibold text-[var(--color-ink-600)] px-1 mb-1.5">{title}</h3>
      <div className="overflow-x-auto card">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="hairline-b">
            <tr>
              <th className="px-3 py-2 text-[11px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide sticky left-0 bg-white w-[220px]">Account</th>
              {MONTHS.map((m) => <th key={m} className="px-1 py-2 text-[11px] font-medium text-[var(--color-ink-400)] uppercase text-right w-[70px]">{m}</th>)}
              <th className="px-2 py-2 text-[11px] font-medium text-[var(--color-ink-400)] uppercase text-right w-[90px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="hairline-t">
                <td className="px-3 py-1.5 text-[12.5px] font-medium sticky left-0 bg-white whitespace-nowrap">{a.code} · {a.name}</td>
                {MONTHS.map((m) => (
                  <td key={m} className="px-0.5 py-1">
                    <input
                      type="number"
                      step="0.01"
                      value={values.get(`${a.id}-${m}`) || ""}
                      onChange={(e) => setCell(a.id, m, e.target.value)}
                      className="w-full text-right text-[12px] px-1.5 py-1 rounded border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] outline-none"
                      placeholder="0"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-[12.5px] text-right font-medium tnum">{rowTotal(a.id).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={14} className="px-4 py-6 text-center text-[var(--color-ink-400)] text-[12.5px]">No accounts of this type.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <Section title="Income" rows={income} />
      <Section title="Expenses" rows={expense} />
      <div className="flex items-center gap-3 mt-2">
        <button onClick={handleSave} disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
          {pending ? "Saving…" : "Save budget"}
        </button>
        {error && <span className="text-[12.5px] text-[var(--color-bad)]">{error}</span>}
        {saved && <span className="text-[12.5px] text-[var(--color-good)]">Saved.</span>}
      </div>
    </div>
  );
}
