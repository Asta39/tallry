/** Shared FAQ content — used both by the client-rendered accordion
 *  (src/components/ZenoFAQ.tsx) and the homepage's FAQPage JSON-LD
 *  (src/app/page.tsx, a server component). Kept in its own plain module
 *  (no "use client") because a data export from a client-boundary file
 *  resolves to an unusable client-reference stub when imported into server
 *  code, rather than the real array. */
export const FAQS: { q: string; a: string }[] = [
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
    a: "Every plan includes free onboarding support. Reach us any time at hello@zenobooks.co.ke, or use the assistant on this page for a quick answer first.",
  },
];
