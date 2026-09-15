"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";

const SUPPORT_EMAIL = "hello@zenobooks.co.ke";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How does pricing actually work?",
    a: "Every business gets a 30-day free trial with full access to every module. After that, pricing is module-based — pick CRM, Accounting, and/or Payroll in any combination — with a one-time setup fee, a one-time unlock fee per module, and a small recurring monthly fee per staff seat. There are no subscription tiers to pick between.",
  },
  {
    q: "What is the monthly maintenance fee for?",
    a: "It covers hosting, support, and updates, and scales with your team — roughly KSh 1,000 per staff seat per month as a starting point. It's billed on top of the one-time setup and module fees, recalculates automatically as you add or remove staff, and can be adjusted for your business during onboarding.",
  },
  {
    q: "Can I change modules later?",
    a: "Yes. Add or drop a module any time and your billing adjusts accordingly — turning one off just hides it from the interface, it never deletes your data, so switching it back on picks up right where you left off.",
  },
  {
    q: "Does Zeno calculate KRA VAT correctly?",
    a: "Yes — 16% standard, zero-rated, and exempt are all handled per line on every invoice, and the reports you need to file a VAT return are built in. Zeno does not yet have a live KRA eTIMS/OSCU integration, so fiscal signing of invoices still happens through your own registered device or process.",
  },
  {
    q: "How does M-Pesa reconciliation work?",
    a: "Connect Daraja or Kopo Kopo and Zeno matches incoming STK push payments and bank statement lines against your invoices and bills automatically, instead of you cross-checking a paper trail by hand.",
  },
  {
    q: "Is my business data secure?",
    a: "Your data is encrypted in transit and at rest, isolated per organisation, and handled under the Kenya Data Protection Act. You can export everything at any time, and we never share your records with another business on the platform.",
  },
  {
    q: "What happens to my data if I stop paying?",
    a: "Access pauses rather than deletes — a single contact screen replaces the app until you reactivate. Your books stay intact, so nothing is lost by taking a break.",
  },
  {
    q: "Does payroll handle Kenyan statutory deductions?",
    a: "Yes — PAYE, NSSF, SHIF, and the Housing Levy are calculated automatically on every run, along with staff loans and salary advances deducted straight from payslips.",
  },
  {
    q: "What if I need help getting started?",
    a: `Every plan includes free onboarding support. Reach us any time at ${SUPPORT_EMAIL}, or use the assistant on this page for a quick answer first.`,
  },
];

const revealVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.3, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

function PlusIcon({ open }: { open: boolean }) {
  return (
    <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
      <motion.span
        className="absolute h-[1.5px] w-3.5 bg-gray-900"
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.span
        className="absolute h-[1.5px] w-3.5 bg-gray-900"
        animate={{ rotate: open ? -45 : 90 }}
        transition={{ duration: 0.2 }}
      />
    </span>
  );
}

export function ZenoFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full bg-white" ref={faqRef}>
      <div className="max-w-3xl mx-auto px-4 py-20 sm:py-28">
        <div className="text-center mb-14">
          <TimelineContent as="p" animationNum={0} timelineRef={faqRef} customVariants={revealVariants} className="text-[#0f766e] font-medium mb-3">
            Questions
          </TimelineContent>
          <h2 className="md:text-4xl sm:text-4xl text-3xl font-semibold text-gray-900 leading-[120%]">
            <VerticalCutReveal splitBy="words" staggerDuration={0.15} staggerFrom="first" reverse containerClassName="justify-center" transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0.2 }}>
              Answers before you ask
            </VerticalCutReveal>
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <TimelineContent key={item.q} as="div" animationNum={i + 1} timelineRef={faqRef} customVariants={revealVariants}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-6 py-5 text-left"
                >
                  <span className="text-[15px] sm:text-base font-medium text-gray-900">{item.q}</span>
                  <PlusIcon open={open} />
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 pr-10 text-sm leading-relaxed text-gray-600">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TimelineContent>
            );
          })}
        </div>
      </div>
    </div>
  );
}
