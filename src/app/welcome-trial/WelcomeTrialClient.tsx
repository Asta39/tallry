"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeWelcomeTrialAction, type ModulePreference } from "./actions";

const TRIAL_FEATURES = [
  { icon: "🧾", label: "Invoicing, quotes & credit notes", desc: "KRA-compliant VAT on every line, eTIMS-ready" },
  { icon: "👥", label: "Customers, vendors & deals", desc: "Full contact history, pipeline, and account statements" },
  { icon: "📦", label: "Bills, purchase orders & inventory", desc: "FIFO costing, warehouses, stock transfers" },
  { icon: "🏦", label: "Bank & M-Pesa reconciliation", desc: "Match statements, categorize, mirror the real books" },
  { icon: "🧑‍💼", label: "Payroll, loans & salary advances", desc: "PAYE, NSSF, SHIF, AHL — statutory-compliant" },
  { icon: "🖥️", label: "Fixed assets & depreciation", desc: "Full asset register, straight-line depreciation" },
  { icon: "🏢", label: "Multi-location reporting", desc: "P&L and cost centers broken down by branch" },
  { icon: "👤", label: "Unlimited staff & role permissions", desc: "Fine-grained access per team member" },
];

const MODULE_OPTIONS: { value: ModulePreference; label: string; desc: string; recommended?: boolean }[] = [
  { value: "crm", label: "CRM only", desc: "Customers, deals, quotes & invoicing — the sales side." },
  { value: "crm_accounting", label: "CRM + Accounting", desc: "Adds the ledger, banking, reports and fixed assets." },
  { value: "crm_payroll", label: "CRM + Payroll", desc: "Adds payroll, statutory deductions, loans & advances." },
  { value: "all", label: "All of it", desc: "CRM, Accounting and Payroll together.", recommended: true },
];

export function WelcomeTrialClient({ orgName }: { orgName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<ModulePreference | null>(null);
  const [error, setError] = useState<string | null>(null);

  function finish(pref: ModulePreference | null) {
    setError(null);
    startTransition(async () => {
      try {
        await completeWelcomeTrialAction(pref);
        router.push("/");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[var(--color-ink-50)]">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand,#0f766e)]/10 to-transparent">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand,#0f766e)]/5 blur-3xl rounded-full" />
          <div className="relative z-10 px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand,#0f766e)]/10 text-[var(--color-brand,#0f766e)] mb-4">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Trial started
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
              Welcome to Zeno, <br className="md:hidden" /> {orgName}
            </h1>
            <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto">
              You have 7 days of full, unrestricted access — every module below, no card required. Here's what's included and what happens next.
            </p>
          </div>
        </div>

        {/* What's included */}
        <div>
          <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">Everything's unlocked for your trial</h2>
          <p className="text-center text-[13.5px] text-[var(--color-ink-500)] mt-2 max-w-lg mx-auto">
            No tiers, no locked features — try the whole system exactly as a paying org would use it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {TRIAL_FEATURES.map((f) => (
              <div key={f.label} className="card p-4 flex items-start gap-3">
                <span className="text-[20px] shrink-0">{f.icon}</span>
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">{f.label}</div>
                  <div className="text-[12px] text-[var(--color-ink-500)] mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What happens when it ends */}
        <div className="card p-6">
          <h2 className="text-[15px] font-bold text-[var(--color-ink-900)]">What happens when your trial ends</h2>
          <p className="text-[13px] text-[var(--color-ink-500)] mt-2 leading-relaxed">
            After 7 days, access pauses — every page shows a single screen with our contact details until we reactivate your account. Reactivation is a one-time setup fee, agreed directly with us, after which you're billed KSh 1,000 per seat per month (you plus every staff member you add) — covers hosting, backups, KRA/eTIMS compliance updates and support, and you can pay it in-app or have us record it for you. Nothing you enter during the trial is lost — it's all still there the moment you're reactivated.
          </p>
        </div>

        {/* Module preference */}
        <div>
          <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">Which parts do you want, going forward?</h2>
          <p className="text-center text-[13.5px] text-[var(--color-ink-500)] mt-2 max-w-lg mx-auto">
            Not a limit on your trial — just tells us what to set you up with once you're ready to continue. You can change this any time.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {MODULE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`text-left rounded-2xl border-2 p-5 transition-colors ${
                  selected === opt.value
                    ? "border-[var(--color-brand,#0f766e)] bg-[var(--color-brand,#0f766e)]/5"
                    : "border-[var(--color-ink-200)] bg-white hover:border-[var(--color-ink-300)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-semibold text-[var(--color-ink-900)]">{opt.label}</div>
                  {opt.recommended && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand,#0f766e)] bg-[var(--color-brand,#0f766e)]/10 rounded-full px-2 py-0.5">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-[var(--color-ink-500)] mt-1.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-[var(--color-bad)]">{error}</div>
        )}

        <div className="flex flex-col items-center gap-3 pb-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => finish(selected)}
            className="w-full sm:w-auto rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[14px] font-semibold px-8 py-3"
          >
            {pending ? "Setting things up…" : "Continue to my dashboard"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => finish(null)}
            className="text-[12.5px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-700)] disabled:opacity-60"
          >
            I'll decide later
          </button>
        </div>
      </div>
    </div>
  );
}
