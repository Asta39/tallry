"use client";

import { useState, useTransition } from "react";
import { fmtKES } from "@/lib/money";
import { setOrgModuleAccessAction, recordModulePaymentAction } from "../../actions";

interface ModulePaymentRow {
  id: number;
  moduleKey: string | null;
  amountCents: number;
  createdAt: string;
  note: string | null;
}

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all";
const MODULE_LABELS: Record<string, string> = { crm: "CRM", accounting: "Accounting", payroll: "Payroll" };

export function ModuleAccessPanel({
  orgId,
  crmEnabled,
  accountingEnabled,
  payrollEnabled,
  modulePreference,
  modulePayments,
}: {
  orgId: number;
  crmEnabled: boolean;
  accountingEnabled: boolean;
  payrollEnabled: boolean;
  modulePreference: string | null;
  modulePayments: ModulePaymentRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [crm, setCrm] = useState(crmEnabled);
  const [accounting, setAccounting] = useState(accountingEnabled);
  const [payroll, setPayroll] = useState(payrollEnabled);

  function run(action: () => Promise<{ success?: boolean; error?: string } | undefined>, okMsg: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
      else setSuccess(okMsg);
    });
  }

  const preferenceLabel = modulePreference
    ? { crm: "CRM only", crm_accounting: "CRM + Accounting", crm_payroll: "CRM + Payroll", all: "All of it" }[modulePreference] || modulePreference
    : "Not stated";

  return (
    <div>
      <p className="text-[12.5px] text-[var(--color-ink-500)] mb-3">
        Controls what shows in this org's sidebar — nothing is deleted or stopped in the background when a module is off, it's just hidden. Stated on their welcome screen: <span className="font-medium text-[var(--color-ink-700)]">{preferenceLabel}</span>.
      </p>

      <form
        className="flex flex-wrap items-center gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => setOrgModuleAccessAction(orgId, fd), "Module access updated.");
        }}
      >
        {([
          { key: "crmEnabled", label: "CRM", checked: crm, set: setCrm },
          { key: "accountingEnabled", label: "Accounting", checked: accounting, set: setAccounting },
          { key: "payrollEnabled", label: "Payroll", checked: payroll, set: setPayroll },
        ] as const).map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
            <input
              type="checkbox"
              name={m.key}
              checked={m.checked}
              onChange={(e) => m.set(e.target.checked)}
              className="w-4 h-4 accent-red-600"
            />
            {m.label}
          </label>
        ))}
        <button type="submit" disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2">
          Save
        </button>
      </form>

      <ModulePaymentForm orgId={orgId} run={run} pending={pending} />

      {error && <p className="mt-2 text-[12px] text-[var(--color-bad)]">{error}</p>}
      {success && <p className="mt-2 text-[12px] text-[var(--color-good)]">{success}</p>}

      {modulePayments.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-ink-100)]">
          <div className="text-[11.5px] text-[var(--color-ink-400)] mb-2">Module payments</div>
          <ul className="divide-y divide-[var(--color-ink-100)]">
            {modulePayments.map((p) => (
              <li key={p.id} className="py-1.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--color-ink-500)]">
                  {p.createdAt.slice(0, 10)} · {MODULE_LABELS[p.moduleKey || ""] || p.moduleKey}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className="font-medium">{fmtKES(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ModulePaymentForm({
  orgId,
  run,
  pending,
}: {
  orgId: number;
  run: (action: () => Promise<{ success?: boolean; error?: string } | undefined>, okMsg: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-[12.5px] font-medium text-[var(--color-accent-600)] hover:underline">
        Record a payment for another module
      </button>
    );
  }

  return (
    <form
      className="mt-3 pt-3 border-t border-[var(--color-ink-100)] space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        run(() => recordModulePaymentAction(orgId, fd), "Module payment recorded — that module is now on.");
        setOpen(false);
      }}
    >
      <div className="text-[11.5px] text-[var(--color-ink-400)]">
        E.g. an org that started CRM-only later pays for Accounting or Payroll — records the payment and switches that module on.
      </div>
      <div className="flex flex-wrap gap-2">
        <select name="module" required className={inputCls} defaultValue="">
          <option value="" disabled>
            Which module?
          </option>
          <option value="crm">CRM</option>
          <option value="accounting">Accounting</option>
          <option value="payroll">Payroll</option>
        </select>
        <input name="amount" type="number" step="0.01" min="0.01" required placeholder="Amount (KES)" className={inputCls} />
        <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputCls} />
      </div>
      <input name="note" type="text" placeholder="Note (optional)" className={`${inputCls} w-full`} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2">
          {pending ? "Saving…" : "Record & switch on"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--color-ink-200)] text-[13px] font-medium px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
