"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBudgetAction } from "@/lib/budgets";

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

export function NewBudgetForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear()));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const res = await createBudgetAction({ name, fiscalYear });
            router.push(`/accounting/budgets/${res.id}`);
          } catch (e: any) {
            setError(e.message || "Could not create budget");
          }
        });
      }}
      className="card p-5 max-w-md space-y-4"
    >
      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Annual Operating Budget" className={inputCls + " w-full mt-1"} />
      </label>
      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Fiscal year</span>
        <input value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)} required className={inputCls + " w-32 mt-1"} />
      </label>
      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
        {pending ? "Creating…" : "Create budget"}
      </button>
    </form>
  );
}
