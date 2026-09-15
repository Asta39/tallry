"use client";

import { useRef } from "react";
import Link from "next/link";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";

const PERKS = [
  {
    title: "One product, not several apps stitched together",
    copy: "Accounting, CRM, and Payroll live in the same system — no separate logins or connectors to maintain.",
  },
  {
    title: "Reconciliation that actually happens automatically",
    copy: "M-Pesa STK pushes and bank statements get matched to your invoices and bills on their own.",
  },
  {
    title: "Simple KES pricing, not a tiered subscription",
    copy: "One-time setup and module fees, then a flat monthly fee per staff seat — no plan tiers to compare.",
  },
  {
    title: "No local partner required to get started",
    copy: "Sign up directly and you're live — nothing to hand off to a certified integrator first.",
  },
  {
    title: "Built for how one country actually taxes and pays people",
    copy: "PAYE, NSSF, SHIF, AHL, and VAT are already set up correctly — not a generic global template you have to configure yourself.",
  },
  {
    title: "Fewer clicks, not a settings maze",
    copy: "Quote to invoice, running payroll, matching a payment — each takes a couple of clicks, not a trip through a configuration menu first.",
  },
];

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

export function ZenoPerks() {
  const perksRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full bg-white" ref={perksRef}>
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-24">
        <div className="text-center mb-14">
          <TimelineContent as="p" animationNum={0} timelineRef={perksRef} customVariants={revealVariants} className="text-[#0f766e] font-medium mb-3">
            Why Zeno
          </TimelineContent>
          <h2 className="md:text-4xl sm:text-4xl text-3xl font-semibold text-gray-900 leading-[120%] mb-4">
            <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse containerClassName="justify-center" transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0.2 }}>
              Built differently, on purpose
            </VerticalCutReveal>
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto">
            Compared to the general-purpose accounting and ERP platforms most Kenyan
            businesses default to.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
          {PERKS.map((perk, i) => (
            <TimelineContent key={perk.title} as="div" animationNum={i + 1} timelineRef={perksRef} customVariants={revealVariants}>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">{perk.title}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{perk.copy}</p>
            </TimelineContent>
          ))}
        </div>

        <TimelineContent as="div" animationNum={7} timelineRef={perksRef} customVariants={revealVariants} className="mt-14 text-center">
          <Link
            href="/vs/competitors"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border-4 shadow-sm shadow-black border-black bg-gradient-to-t from-neutral-900 via-neutral-800 to-neutral-900 text-white text-sm font-semibold"
          >
            See a detailed comparison →
          </Link>
        </TimelineContent>
      </div>
    </div>
  );
}
