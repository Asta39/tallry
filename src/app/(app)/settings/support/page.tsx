export const dynamic = "force-dynamic";

const SUPPORT_PHONE = "+254115706542";
const SUPPORT_PHONE_WA = "254115706542";

const FAQS = [
  {
    q: "My trial ended and everything's locked — what now?",
    a: "That's expected once the 7-day trial is over. Call or WhatsApp us below and we'll get your account activated the same day.",
  },
  {
    q: "I did bank reconciliation but my new statement balance wasn't used.",
    a: "If you had an unfinished reconciliation from a previous day, clicking \"Start reconciliation\" now updates it with today's date and balance — reload the Banking page and try again.",
  },
  {
    q: "I registered a fixed asset but its value isn't showing under the asset account.",
    a: "Check the asset's row on Fixed Assets — if it says \"Not recorded\", click \"Record purchase\" and pick which account it was actually paid from.",
  },
  {
    q: "How do I get a staff member their own salary advance / loan?",
    a: "Payroll → Loans issues a longer-term loan; Payroll → Salary Advances lets you issue one directly or approve a request a staff member submitted themselves.",
  },
  {
    q: "A report is showing KSh 0 or looks wrong for a new location/branch.",
    a: "Location-filtered reports (P&L, Income vs Expense) only include transactions where a Cost Center was picked on the line — tag your invoice/bill/expense lines with a location for it to show up.",
  },
  {
    q: "How do I let an accountant see everything even with Data Segregation on?",
    a: "Staff & Roles → toggle \"View org-wide invoices/documents\" for their role. Accountant has this on by default.",
  },
  {
    q: "Where do I change my monthly maintenance fee or see what I've paid?",
    a: "Settings → Billing shows your current fee, a Pay Now button, and your full payment history.",
  },
  {
    q: "Something else / this isn't listed here.",
    a: "Just call or WhatsApp us — describe what you were doing when it happened and we'll sort it out directly.",
  },
];

export default async function SupportPage() {
  return (
    <div className="space-y-16 pb-12">
      {/* Hero */}
      <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand)]/10 to-transparent">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand)]/5 blur-3xl rounded-full" />
        <div className="relative z-10 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
            </svg>
            We're here to help
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Talk to a real person, <br className="md:hidden" /> any time
          </h1>
          <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto">
            No ticket queue, no bots — call or WhatsApp us directly and we'll help you sort it out.
          </p>
        </div>
      </div>

      {/* Contact card */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="card p-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={`tel:${SUPPORT_PHONE}`}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            Call {SUPPORT_PHONE}
          </a>
          <a
            href={`https://wa.me/${SUPPORT_PHONE_WA}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg border border-[var(--color-ink-200)] hover:border-[var(--color-ink-400)] text-[13px] font-medium px-5 py-2.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
            WhatsApp us
          </a>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">Common questions</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((f) => (
            <div key={f.q} className="card p-5">
              <div className="text-[14px] font-semibold text-[var(--color-ink-900)]">{f.q}</div>
              <div className="text-[13px] text-[var(--color-ink-500)] mt-1.5">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
