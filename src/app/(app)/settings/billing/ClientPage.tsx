"use client";

import { useState } from "react";
import { PLANS, PlanKey, Entitlements } from "@/lib/billing";
import { fmtKES } from "@/lib/money";
import { simulateSubscriptionUpgradeAction } from "./actions";

const ALL_FEATURES = [
  { key: "invoices", label: "Invoices & Quotes" },
  { key: "staff", label: "Staff Seats" },
  { key: "recurring", label: "Recurring Invoices" },
  { key: "gateways", label: "Automated Payment Gateways" },
  { key: "sms", label: "Advanta SMS Integration" },
  { key: "portal", label: "Customer Portal" },
  { key: "payroll", label: "Payroll Module" },
  { key: "payouts", label: "B2B Payouts" },
];

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

  const renderCheck = (hasFeature: boolean | number | string) => {
    if (typeof hasFeature === "boolean") {
      return hasFeature ? (
        <div className="mx-auto w-6 h-6 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
        </div>
      ) : (
        <div className="mx-auto w-6 h-6 bg-[var(--color-ink-100)] text-[var(--color-ink-300)] rounded-full flex items-center justify-center">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
      );
    }
    return <span className="font-semibold text-[var(--color-ink-900)]">{hasFeature === -1 ? "Unlimited" : hasFeature}</span>;
  };

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand)]/10 to-transparent">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand)]/5 blur-3xl rounded-full" />
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Pricing Plan
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Explore Our <br className="md:hidden" /> Affordable Pricing!
          </h1>
          <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto px-4">
            Discover tools built to simplify tasks, reduce friction, and keep your creative momentum flowing.
          </p>
          
          <div className="mt-8 inline-flex items-center bg-white p-1 rounded-full shadow-sm border border-[var(--color-ink-200)]">
            <button className="px-6 py-2 text-[13px] font-semibold bg-[var(--color-brand)] text-white rounded-full shadow-md">
              Monthly
            </button>
            <button className="px-6 py-2 text-[13px] font-medium text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)] rounded-full transition-colors flex items-center gap-2">
              Annual <span className="bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-[10px] px-2 py-0.5 rounded-full font-bold">Save 20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
        {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
          const isActive = entitlements.plan === key;
          const isPopular = key === "standard";
          
          return (
            <div 
              key={key} 
              className={`relative flex flex-col bg-white rounded-3xl p-8 transition-all duration-300 ${
                isPopular 
                  ? "ring-2 ring-[var(--color-brand)] shadow-2xl scale-[1.02] z-10" 
                  : "border border-[var(--color-ink-100)] shadow-lg hover:shadow-xl"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-accent-500)] text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                  Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-lg font-bold text-[var(--color-ink-900)]">{plan.name}</h3>
                <p className="text-[13px] text-[var(--color-ink-500)] mt-1">Predict bottlenecks and optimize team</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
                    {plan.priceCents === 0 ? "$0" : fmtKES(plan.priceCents).replace(".00", "")}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--color-ink-500)]">/ Month</span>
                </div>
              </div>
              
              <button
                onClick={() => handleUpgrade(key)}
                disabled={busy !== null || isActive}
                className={`w-full py-3.5 rounded-xl text-[14px] font-semibold transition-all mb-8 shadow-sm ${
                  isActive 
                    ? "bg-[var(--color-ink-100)] text-[var(--color-ink-500)] cursor-not-allowed" 
                    : isPopular
                      ? "bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-accent-500)] text-white hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
                      : "bg-white border-2 border-[var(--color-ink-100)] text-[var(--color-ink-900)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                }`}
              >
                {busy === key ? "Processing..." : isActive ? "Current Plan" : plan.priceCents === 0 ? "Start For Free" : "Upgrade"}
              </button>
              
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[var(--color-ink-900)] mb-4 uppercase tracking-wider">Features included</p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3 text-[13.5px] text-[var(--color-ink-700)] font-medium">
                    <div className="mt-0.5 shrink-0 w-5 h-5 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {plan.invoices === -1 ? "Unlimited" : plan.invoices} Invoices / Quotes
                  </li>
                  <li className="flex items-start gap-3 text-[13.5px] text-[var(--color-ink-700)] font-medium">
                    <div className="mt-0.5 shrink-0 w-5 h-5 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    Up to {plan.staff} Staff Seats
                  </li>
                  <li className="flex items-start gap-3 text-[13.5px] text-[var(--color-ink-700)] font-medium">
                    <div className="mt-0.5 shrink-0 w-5 h-5 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    {plan.reporting === "advanced" ? "Advanced" : plan.reporting === "standard" ? "Standard" : "Basic"} Reporting
                  </li>
                  {plan.gateways && (
                    <li className="flex items-start gap-3 text-[13.5px] text-[var(--color-ink-700)] font-medium">
                      <div className="mt-0.5 shrink-0 w-5 h-5 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      Automated Payment Gateways
                    </li>
                  )}
                  {plan.payroll && (
                    <li className="flex items-start gap-3 text-[13.5px] text-[var(--color-ink-700)] font-medium">
                      <div className="mt-0.5 shrink-0 w-5 h-5 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      Full Payroll Module
                    </li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Compare Plans Section */}
      <div className="pt-16 max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Compare Plan
          </div>
          <h2 className="text-3xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Discover The Best Coaching <br className="md:hidden" /> Plan For Your Business
          </h2>
          <p className="mt-3 text-[15px] text-[var(--color-ink-600)]">
            The efficiency of starting projects and improves teamwork.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[var(--color-ink-100)] shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-1/4 p-6 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent border-b border-r border-[var(--color-ink-100)]">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Features</span>
                  <span className="block text-xs font-normal text-[var(--color-ink-500)] mt-1">Choose the perfect plan tailored to your team's size, pace, and growth.</span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-r border-[var(--color-ink-100)] bg-white">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Free</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">$0 <span className="text-xs font-medium text-[var(--color-ink-500)]">/ Month</span></span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-r border-[var(--color-ink-100)] bg-white relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)]" />
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Standard</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">{fmtKES(PLANS.standard.priceCents).replace(".00", "")} <span className="text-xs font-medium text-[var(--color-ink-500)]">/ Month</span></span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-[var(--color-ink-100)] bg-white">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Business</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">{fmtKES(PLANS.business.priceCents).replace(".00", "")} <span className="text-xs font-medium text-[var(--color-ink-500)]">/ Month</span></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURES.map((feature, idx) => (
                <tr key={feature.key} className={idx % 2 === 0 ? "bg-white" : "bg-[var(--color-ink-50)]/50"}>
                  <td className="p-4 px-6 text-[14px] font-medium text-[var(--color-ink-700)] border-b border-r border-[var(--color-ink-100)]">
                    {feature.label}
                  </td>
                  <td className="p-4 text-center border-b border-r border-[var(--color-ink-100)]">
                    {renderCheck((PLANS.free as any)[feature.key])}
                  </td>
                  <td className="p-4 text-center border-b border-r border-[var(--color-ink-100)]">
                    {renderCheck((PLANS.standard as any)[feature.key])}
                  </td>
                  <td className="p-4 text-center border-b border-[var(--color-ink-100)]">
                    {renderCheck((PLANS.business as any)[feature.key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
