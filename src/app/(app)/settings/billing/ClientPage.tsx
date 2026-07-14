"use client";

import { useState } from "react";
import { PLANS, PlanKey, Entitlements } from "@/lib/billing";
import { fmtKES } from "@/lib/money";
import { simulateSubscriptionUpgradeAction } from "./actions";

export function BillingClient({ entitlements }: { entitlements: Entitlements }) {
  const [busy, setBusy] = useState<PlanKey | null>(null);

  const handleUpgrade = async (plan: PlanKey) => {
    if (!confirm(`Simulate STK Push to upgrade to ${PLANS[plan].name}?`)) return;
    setBusy(plan);
    try {
      const res = await simulateSubscriptionUpgradeAction(plan);
      if (res.error) alert(res.error);
    } finally {
      setBusy(null);
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const daysRemaining = Math.max(0, Math.ceil((new Date(entitlements.paidUntil).getTime() - new Date().getTime()) / (1000 * 3600 * 24)));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="card p-6 border-l-4 border-l-[var(--color-accent-500)] flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
            Current Plan: {entitlements.limits.name}
          </h2>
          <p className="text-[13px] text-[var(--color-ink-600)] mt-1">
            {entitlements.isReadOnly ? (
              <span className="text-[var(--color-bad)] font-medium">Your subscription has expired. You are in read-only mode.</span>
            ) : (
              <span>Your plan is active for {daysRemaining} more days (Renews {entitlements.paidUntil}).</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => (
          <div key={key} className={`card p-6 flex flex-col ${entitlements.plan === key ? "ring-2 ring-[var(--color-accent-500)] shadow-md" : ""}`}>
            <h3 className="text-xl font-bold text-[var(--color-ink-900)]">{plan.name}</h3>
            <div className="mt-2 text-2xl font-bold text-[var(--color-ink-900)]">
              {plan.priceCents === 0 ? "Free" : fmtKES(plan.priceCents)}
              <span className="text-sm font-normal text-[var(--color-ink-500)]">/mo</span>
            </div>
            
            <ul className="mt-6 space-y-3 flex-1 text-[13px] text-[var(--color-ink-700)]">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-good)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {plan.invoices === -1 ? "Unlimited" : plan.invoices} Invoices / mo
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-good)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Up to {plan.staff} Staff Seats
              </li>
              <li className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${plan.gateways ? "text-[var(--color-good)]" : "text-[var(--color-ink-300)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className={plan.gateways ? "" : "text-[var(--color-ink-400)] line-through"}>Automated M-Pesa Gateways</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${plan.sms > 0 ? "text-[var(--color-good)]" : "text-[var(--color-ink-300)]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className={plan.sms > 0 ? "" : "text-[var(--color-ink-400)] line-through"}>{plan.sms} Free SMS Receipts</span>
              </li>
            </ul>

            <button
              onClick={() => handleUpgrade(key)}
              disabled={busy !== null || entitlements.plan === key}
              className={`mt-6 w-full h-10 rounded-lg text-[13px] font-medium transition-colors ${
                entitlements.plan === key 
                  ? "bg-[var(--color-ink-100)] text-[var(--color-ink-500)] cursor-not-allowed" 
                  : "bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] text-white"
              }`}
            >
              {busy === key ? "Processing..." : entitlements.plan === key ? "Current Plan" : "Upgrade"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
