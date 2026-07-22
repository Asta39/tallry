"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PLANS, PlanKey, Entitlements, BillingCycle } from "@/lib/billing";
import { fmtKES } from "@/lib/money";
import { initiateSubscriptionPaymentAction, initiateCardPaymentAction, checkSubscriptionPaymentAction } from "./actions";
import { Player } from "@lottiefiles/react-lottie-player";

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

export function BillingClient({ entitlements, orgPhone, orgEmail }: { entitlements: Entitlements; orgPhone: string; orgEmail: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  // Payment Modal State
  const [modal, setModal] = useState<{
    isOpen: boolean;
    plan: PlanKey | null;
    method: "mpesa" | "card";
    phone: string;
    email: string;
    status: "idle" | "processing" | "redirecting" | "success" | "error";
    error?: string;
  }>({
    isOpen: false,
    plan: null,
    method: "mpesa",
    phone: orgPhone,
    email: orgEmail,
    status: "idle",
  });

  const handleUpgradeClick = (plan: PlanKey) => {
    setModal((prev) => ({ ...prev, isOpen: true, plan, status: "idle", error: undefined }));
  };

  const pollPayment = async (paymentId: number) => {
    // Poll every 3s for up to 2 minutes while the payment settles
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const check = await checkSubscriptionPaymentAction(paymentId);
      if ("error" in check && check.error) {
        setModal((prev) => ({ ...prev, isOpen: true, status: "error", error: check.error }));
        return;
      }
      if ("status" in check) {
        if (check.status === "complete") {
          setModal((prev) => ({ ...prev, isOpen: true, status: "success" }));
          setTimeout(() => window.location.reload(), 2500);
          return;
        }
        if (check.status === "failed") {
          setModal((prev) => ({ ...prev, isOpen: true, status: "error", error: check.reason || "Payment failed — no money was taken." }));
          return;
        }
      }
    }
    setModal((prev) => ({
      ...prev,
      isOpen: true,
      status: "error",
      error: "We didn't get a confirmation in time. If you completed the payment, your plan will activate automatically within a few minutes.",
    }));
  };

  // Resume polling if we've just been redirected back from IntaSend's hosted card checkout.
  useEffect(() => {
    const paymentId = searchParams.get("payment");
    if (!paymentId) return;
    setModal((prev) => ({ ...prev, isOpen: true, status: "processing" }));
    router.replace("/settings/billing");
    pollPayment(Number(paymentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePayment = async () => {
    if (!modal.plan || !modal.phone) return;
    setModal((prev) => ({ ...prev, status: "processing", error: undefined }));

    try {
      const res = await initiateSubscriptionPaymentAction(modal.plan, cycle, modal.phone);
      if ("error" in res && res.error) {
        setModal((prev) => ({ ...prev, status: "error", error: res.error }));
        return;
      }
      const paymentId = (res as { paymentId: number }).paymentId;
      await pollPayment(paymentId);
    } catch (e: any) {
      setModal((prev) => ({ ...prev, status: "error", error: e.message || "An error occurred." }));
    }
  };

  const handleCardPayment = async () => {
    if (!modal.plan || !modal.email) return;
    setModal((prev) => ({ ...prev, status: "redirecting", error: undefined }));

    try {
      const res = await initiateCardPaymentAction(modal.plan, cycle, modal.email);
      if ("error" in res && res.error) {
        setModal((prev) => ({ ...prev, status: "error", error: res.error }));
        return;
      }
      const { checkoutUrl } = res as { paymentId: number; checkoutUrl: string };
      window.location.href = checkoutUrl;
    } catch (e: any) {
      setModal((prev) => ({ ...prev, status: "error", error: e.message || "An error occurred." }));
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
    <div className="space-y-16 pb-12 relative">
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
            <button 
              onClick={() => setCycle("monthly")}
              className={`px-6 py-2 text-[13px] font-semibold rounded-full shadow-md transition-colors ${
                cycle === "monthly" ? "bg-[var(--color-brand)] text-white" : "bg-transparent text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)] shadow-none"
              }`}
            >
              Monthly
            </button>
            <button 
              onClick={() => setCycle("annual")}
              className={`px-6 py-2 text-[13px] font-medium transition-colors flex items-center gap-2 rounded-full ${
                cycle === "annual" ? "bg-[var(--color-brand)] text-white shadow-md" : "bg-transparent text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]"
              }`}
            >
              Annual <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cycle === "annual" ? "bg-white/20 text-white" : "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"}`}>Save 20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-4">
        {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
          const isActive = entitlements.plan === key;
          const isPopular = key === "standard";
          const priceCents = cycle === "annual" ? plan.annualCents : plan.monthlyCents;
          
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
                    {priceCents === 0 ? "$0" : fmtKES(priceCents).replace(".00", "")}
                  </span>
                  <span className="text-[13px] font-medium text-[var(--color-ink-500)]">/ {cycle === "annual" ? "Year" : "Month"}</span>
                </div>
              </div>
              
              <button
                onClick={() => handleUpgradeClick(key)}
                disabled={isActive}
                className={`w-full py-3.5 rounded-xl text-[14px] font-semibold transition-all mb-8 shadow-sm ${
                  isActive 
                    ? "bg-[var(--color-ink-100)] text-[var(--color-ink-500)] cursor-not-allowed" 
                    : isPopular
                      ? "bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-accent-500)] text-white hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5"
                      : "bg-white border-2 border-[var(--color-ink-100)] text-[var(--color-ink-900)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                }`}
              >
                {isActive ? "Current Plan" : priceCents === 0 ? "Start For Free" : "Upgrade"}
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

        <div className="bg-white rounded-3xl border border-[var(--color-ink-100)] shadow-xl overflow-hidden hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-1/4 p-6 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent border-b border-r border-[var(--color-ink-100)]">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Features</span>
                  <span className="block text-xs font-normal text-[var(--color-ink-500)] mt-1">Choose the perfect plan tailored to your team's size, pace, and growth.</span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-r border-[var(--color-ink-100)] bg-white">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Free</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">$0 <span className="text-xs font-medium text-[var(--color-ink-500)]">/ {cycle === "annual" ? "Year" : "Month"}</span></span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-r border-[var(--color-ink-100)] bg-white relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-brand)]" />
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Standard</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">{fmtKES(cycle === "annual" ? PLANS.standard.annualCents : PLANS.standard.monthlyCents).replace(".00", "")} <span className="text-xs font-medium text-[var(--color-ink-500)]">/ {cycle === "annual" ? "Year" : "Month"}</span></span>
                </th>
                <th className="w-1/4 p-6 text-center border-b border-[var(--color-ink-100)] bg-white">
                  <span className="block text-lg font-bold text-[var(--color-ink-900)]">Business</span>
                  <span className="block text-2xl font-extrabold text-[var(--color-ink-900)] mt-2">{fmtKES(cycle === "annual" ? PLANS.business.annualCents : PLANS.business.monthlyCents).replace(".00", "")} <span className="text-xs font-medium text-[var(--color-ink-500)]">/ {cycle === "annual" ? "Year" : "Month"}</span></span>
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

      {/* Payment Modal / Bottom Sheet */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => modal.status !== "processing" && setModal(prev => ({ ...prev, isOpen: false }))} />
          
          <div className="relative w-full h-[65vh] md:h-auto md:w-[420px] bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200 flex flex-col">
            {/* Header */}
            <div className="flex-none flex items-center justify-between p-6 border-b border-[var(--color-ink-100)]">
              <h3 className="text-lg font-bold text-[var(--color-ink-900)]">
                Upgrade to {modal.plan ? PLANS[modal.plan].name : ""}
              </h3>
              {modal.status !== "processing" && (
                <button 
                  onClick={() => setModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-ink-100)] text-[var(--color-ink-500)]"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto flex flex-col">
              {modal.status === "idle" || modal.status === "error" ? (
                <>
                  <div className="mb-auto">
                    <p className="text-[14px] text-[var(--color-ink-600)] mb-6">
                      You are about to pay <strong>{fmtKES(modal.plan ? (cycle === "annual" ? PLANS[modal.plan].annualCents : PLANS[modal.plan].monthlyCents) : 0).replace(".00", "")}</strong> for the {modal.plan ? PLANS[modal.plan].name : ""} plan ({cycle}).
                    </p>

                    {/* Payment method accordion */}
                    <div className="rounded-2xl border border-[var(--color-ink-200)] overflow-hidden divide-y divide-[var(--color-ink-100)]">
                      {/* M-Pesa row */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setModal((prev) => ({ ...prev, method: "mpesa" }))}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-ink-50)] transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-[var(--color-good)]/10 text-[var(--color-good)] flex items-center justify-center shrink-0">
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <span className="flex-1 text-[14px] font-semibold text-[var(--color-ink-900)]">M-Pesa</span>
                          <svg className={`w-4 h-4 text-[var(--color-ink-400)] transition-transform duration-200 ${modal.method === "mpesa" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className={`grid transition-all duration-300 ease-in-out ${modal.method === "mpesa" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="overflow-hidden">
                            <div className="px-4 pb-4 pt-1">
                              <input
                                type="tel"
                                value={modal.phone}
                                onChange={(e) => setModal((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="07XXXXXXXX"
                                className="w-full px-3.5 py-3 bg-[var(--color-ink-50)] border border-[var(--color-ink-200)] rounded-xl text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all font-medium"
                              />
                              <p className="mt-2 text-[12px] text-[var(--color-ink-500)]">
                                An STK push will be sent to this number. Please have your phone ready.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card row */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setModal((prev) => ({ ...prev, method: "card" }))}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-ink-50)] transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center shrink-0">
                            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1zM6 15h4" />
                            </svg>
                          </div>
                          <span className="flex-1 text-[14px] font-semibold text-[var(--color-ink-900)]">Card</span>
                          <svg className={`w-4 h-4 text-[var(--color-ink-400)] transition-transform duration-200 ${modal.method === "card" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div className={`grid transition-all duration-300 ease-in-out ${modal.method === "card" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                          <div className="overflow-hidden">
                            <div className="px-4 pb-4 pt-1">
                              <input
                                type="email"
                                value={modal.email}
                                onChange={(e) => setModal((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="you@business.com"
                                className="w-full px-3.5 py-3 bg-[var(--color-ink-50)] border border-[var(--color-ink-200)] rounded-xl text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all font-medium"
                              />
                              <p className="mt-2 text-[12px] text-[var(--color-ink-500)]">
                                You'll be taken to a secure page to enter your card details.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {modal.error && (
                    <div className="my-6 p-3 bg-[var(--color-bad)]/10 text-[var(--color-bad)] rounded-lg text-[13px] font-medium border border-[var(--color-bad)]/20">
                      {modal.error}
                    </div>
                  )}

                  <button
                    onClick={modal.method === "card" ? handleCardPayment : handlePayment}
                    className="w-full mt-6 py-3.5 rounded-xl text-[14px] font-bold text-white bg-[var(--color-brand)] hover:opacity-90 shadow-lg shadow-[var(--color-brand)]/20 transition-all active:scale-[0.98]"
                  >
                    {modal.method === "card" ? "Continue to card payment" : "Pay with M-Pesa"}
                  </button>
                </>
              ) : modal.status === "redirecting" ? (
                <div className="py-10 flex flex-col items-center justify-center text-center flex-1">
                  <div className="w-8 h-8 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin mb-5" />
                  <h4 className="text-lg font-bold text-[var(--color-ink-900)] mb-2">Taking you to checkout…</h4>
                  <p className="text-[14px] text-[var(--color-ink-500)] max-w-[250px]">
                    Enter your card details on IntaSend's secure page — you'll be brought back here automatically.
                  </p>
                </div>
              ) : modal.status === "processing" ? (
                <div className="py-8 flex flex-col items-center justify-center text-center flex-1">
                  <div className="w-56 h-56 mb-4">
                    <Player
                      autoplay
                      loop
                      src="https://lottie.host/988ad23c-a0b0-492d-b31d-3b60a924e89a/IZdC3LuBul.json"
                      style={{ height: '100%', width: '100%' }}
                    />
                  </div>
                  <h4 className="text-lg font-bold text-[var(--color-ink-900)] mb-2">
                    {modal.method === "card" ? "Confirming Payment" : "Check Your Phone"}
                  </h4>
                  <p className="text-[14px] text-[var(--color-ink-500)] max-w-[250px]">
                    {modal.method === "card"
                      ? "We're confirming your card payment with IntaSend — this only takes a moment."
                      : <>We've sent an M-Pesa prompt to <strong>{modal.phone}</strong>. Please enter your PIN to complete the payment.</>}
                  </p>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center text-center flex-1">
                  <div className="w-20 h-20 bg-[var(--color-good)]/10 text-[var(--color-good)] rounded-full flex items-center justify-center mb-6">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h4 className="text-xl font-bold text-[var(--color-ink-900)] mb-2">Payment Successful!</h4>
                  <p className="text-[14px] text-[var(--color-ink-500)]">
                    Your {modal.plan ? PLANS[modal.plan].name : ""} plan is now active for a {cycle}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
