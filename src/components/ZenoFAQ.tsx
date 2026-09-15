"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { FAQS } from "@/lib/faq-content";

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
    <div id="faq" className="w-full bg-white" ref={faqRef}>
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
