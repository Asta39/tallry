"use client";

import * as React from "react";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";
import { PRICING_PACKAGES, type PricingPackage } from "@/lib/pricing-packages";

const FEATURES = [
  "Invoices & quotes with KRA VAT built in",
  "eTIMS-ready, compliant out of the box",
  "M-Pesa & bank reconciliation",
  "Payroll — PAYE, NSSF, SHIF, AHL",
  "CRM pipeline from lead to invoice",
  "Reports & dashboards",
  "Free onboarding support",
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1L11.8 8.2L19 10L11.8 11.8L10 19L8.2 11.8L1 10L8.2 8.2L10 1Z" />
    </svg>
  );
}

// ----------------------------------------------------------------------
// PricingSwitch — same two-option animated pill toggle as the reference
// component, unmodified mechanic/styling; only the labels change per use.
// ----------------------------------------------------------------------
const PricingSwitch = ({
  button1,
  button2,
  onSwitch,
  className,
  layoutId,
}: {
  button1: string;
  button2: string;
  onSwitch: (value: string) => void;
  className?: string;
  layoutId?: string;
}) => {
  const [selected, setSelected] = useState("0");
  const uniqueId = useId();
  const switchLayoutId = layoutId || `switch-${uniqueId}`;

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className={cn("relative z-10 w-full flex rounded-full bg-neutral-50 border border-gray-200 p-1", className)}>
      <button
        onClick={() => handleSwitch("0")}
        className={cn(
          "relative z-10 w-full sm:h-14 h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
          selected === "0" ? "text-white" : "text-muted-foreground hover:text-black"
        )}
      >
        {selected === "0" && (
          <motion.span
            layoutId={switchLayoutId}
            className="absolute top-0 left-0 sm:h-14 h-10 w-full rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative">{button1}</span>
      </button>

      <button
        onClick={() => handleSwitch("1")}
        className={cn(
          "relative z-10 w-full sm:h-14 h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
          selected === "1" ? "text-white" : "text-muted-foreground hover:text-black"
        )}
      >
        {selected === "1" && (
          <motion.span
            layoutId={switchLayoutId}
            className="absolute top-0 left-0 sm:h-14 h-10 w-full rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
        <span className="relative flex justify-center items-center gap-2">{button2}</span>
      </button>
    </div>
  );
};

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.3, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};
const timelineVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

/** The two switches are booleans (Accounting on/off, Payroll on/off) —
 *  CRM is the always-included base module — so their four combinations map
 *  exactly onto the four real packages in pricing-packages.ts. */
function packageForSelection(hasAccounting: boolean, hasPayroll: boolean): PricingPackage {
  const key = !hasAccounting && !hasPayroll ? "crm"
    : hasAccounting && !hasPayroll ? "crm_accounting"
    : hasAccounting && hasPayroll ? "crm_accounting_payroll"
    : "crm_payroll";
  return PRICING_PACKAGES.find((p) => p.key === key)!;
}

type FormState = "idle" | "submitting" | "success" | "error";

function PurchaseModal({ pkg, onClose }: { pkg: PricingPackage; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setError(null);
    try {
      const res = await fetch("/api/purchase-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, packageKey: pkg.key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong — please try again.");
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setError("Something went wrong — please try again.");
      setState("error");
    }
  };

  const inputClass =
    "mt-1.5 w-full h-12 rounded-full border border-gray-200 bg-neutral-50 px-5 text-sm text-gray-900 outline-none placeholder:text-gray-400 transition-colors focus:border-black focus:bg-white focus:ring-2 focus:ring-black/10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        {state === "success" ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900">
              <CheckIcon />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Request sent</h3>
            <p className="mt-2 text-sm text-gray-600">
              We&apos;ll be in touch shortly to arrange payment and get {pkg.label} set up for you.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full h-12 rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900 text-white text-sm font-semibold"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3 className="text-xl font-semibold text-gray-900">One-time purchase</h3>
            <p className="mt-1 text-sm text-gray-600">{pkg.label} <span className="text-gray-400">—</span> KSh {(pkg.amountCents / 100).toLocaleString("en-KE")}</p>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Full name</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Your name" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Phone number</span>
                <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="07xx xxx xxx" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Email address</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.co.ke" />
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state === "submitting"}
                className="flex-1 h-12 rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900 text-white text-sm font-semibold disabled:opacity-60"
              >
                {state === "submitting" ? "Sending…" : "Submit request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ZenoPricing() {
  const [hasAccounting, setHasAccounting] = useState(false);
  const [hasPayroll, setHasPayroll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);

  const selected = packageForSelection(hasAccounting, hasPayroll);

  return (
    <div className="w-full min-h-screen mx-auto relative" ref={pricingRef}>
      {/* Blends the AI section's warm bottom tones into this section,
          flush against the very top of it, so the two sections meet as a
          gradient instead of a hard edge — replaces the reference demo's
          blue radial (which sat 90% down its own box, tuned for that
          demo's layout, not for a seam against the section above it). */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 0%, rgba(245,140,2,0.45) 0%, rgba(238,174,202,0.25) 30%, rgba(255,255,255,0) 70%)",
        }}
      />
      {/* The gradient above is a paler wash over white, so at y=0 it still
          jumps against the AI section's fully-opaque vivid edge color —
          this strip straddles that exact seam with the real edge color,
          blurred, to feather the boundary itself rather than just fade
          the area below it. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-16 h-32 z-0 blur-2xl"
        style={{
          background:
            "radial-gradient(120% 200% at 50% 0%, rgba(245,120,2,0.85) 0%, rgba(238,174,202,0.5) 45%, rgba(255,255,255,0) 80%)",
        }}
      />

      <div className="relative px-4 pt-16 pb-16">
        <div className="max-w-4xl mx-auto text-center relative">
          <TimelineContent as="div" animationNum={0} timelineRef={pricingRef} customVariants={revealVariants} className="flex items-center justify-center mb-4">
            <SparkleIcon className="h-5 w-5 text-[#0f766e] mr-2" />
            <span className="text-[#0f766e] font-medium">Simple, one-time pricing</span>
          </TimelineContent>

          <h1 className="md:text-5xl sm:text-4xl text-3xl font-semibold text-gray-900 mb-4 leading-[120%]">
            <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse containerClassName="justify-center" transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0.4 }}>
              Pick your modules, pay once
            </VerticalCutReveal>
          </h1>

          <TimelineContent as="p" animationNum={1} timelineRef={pricingRef} customVariants={revealVariants} className="text-xl text-gray-600">
            30 days free to try everything. Keep only what you need.
          </TimelineContent>
        </div>
      </div>

      <div className="px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 md:gap-12 gap-4 items-start">
            <div>
              <TimelineContent as="h3" animationNum={2} timelineRef={pricingRef} customVariants={revealVariants} className="text-3xl font-medium text-gray-900 mb-2">
                What&apos;s inside
              </TimelineContent>

              <div className="space-y-4">
                {FEATURES.map((feature, index) => (
                  <TimelineContent key={feature} as="div" animationNum={3 + index} timelineRef={pricingRef} customVariants={timelineVariants} className="flex items-center">
                    <div className="w-6 h-6 bg-blue-500 shadow-md shadow-blue-500 rounded-full flex items-center justify-center mr-3">
                      <CheckIcon />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </TimelineContent>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <TimelineContent as="div" animationNum={3} timelineRef={pricingRef} customVariants={revealVariants}>
                <h4 className="font-semibold text-gray-900 mb-2">Add Accounting</h4>
                <p className="text-sm text-gray-600 mb-2">Invoicing, VAT, bills, and financial reports</p>
                <PricingSwitch button1="Just CRM" button2="+ Accounting" onSwitch={(v) => setHasAccounting(v === "1")} className="grid grid-cols-2 w-full" />
              </TimelineContent>

              <TimelineContent as="div" animationNum={4} timelineRef={pricingRef} customVariants={revealVariants}>
                <h4 className="font-semibold text-gray-900 mb-1">Add Payroll</h4>
                <p className="text-sm text-gray-600 mb-2">PAYE, NSSF, SHIF, AHL calculated automatically</p>
                <PricingSwitch button1="No Payroll" button2="+ Payroll" onSwitch={(v) => setHasPayroll(v === "1")} className="grid grid-cols-2 w-full" />
              </TimelineContent>

              <TimelineContent as="div" animationNum={5} timelineRef={pricingRef} customVariants={revealVariants} className="text-center px-2">
                <div className="flex items-center justify-center mb-4">
                  <span className="text-5xl font-semibold text-gray-900">
                    KSh <NumberFlow value={selected.amountCents / 100} className="text-5xl font-semibold" />
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">{selected.label} — one-time fee</p>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/signup"
                    className="text-white text-lg font-semibold h-14 w-full rounded-full border-4 shadow-sm shadow-blue-600 border-blue-600 bg-gradient-to-t from-blue-600 via-blue-500 to-blue-600 flex items-center justify-center"
                  >
                    Start 30-day free trial
                  </Link>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="text-white text-lg font-semibold h-14 w-full rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900"
                  >
                    One-time purchase
                  </button>
                </div>
              </TimelineContent>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && <PurchaseModal pkg={selected} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
