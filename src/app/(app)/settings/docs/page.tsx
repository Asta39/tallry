import { getAccess } from "@/lib/access";

export const dynamic = "force-dynamic";

interface Step {
  title: string;
  desc: string;
}

interface DocSection {
  num: string;
  title: string;
  subtitle?: string;
  tags: string[];
  /** Module permission key(s) required to see this section. Undefined = visible to everyone. */
  perm?: string | string[];
  rolesLabel: string;
  desc: string;
  concepts: string[];
  steps?: Step[];
  note?: string;
  seeAlso?: string[];
}

const SECTIONS: DocSection[] = [
  {
    num: "01",
    title: "How This Guide Works",
    tags: ["Orientation"],
    rolesLabel: "Everyone",
    desc: "The complete guide to running your business on Zeno — every module, in the order a real transaction actually moves through them, written for every role in the org, not just admins.",
    concepts: [
      "Each section covers one part of the system: what it's for, the ideas you need, and the exact steps to use it.",
      "Tags at the top of each section show which area of the business it belongs to — Sales, Money, Spending, Inventory, HR, Admin.",
      "The Roles line tells you who this section matters to. If your role isn't listed, you likely won't see that menu item at all — that's by design, not a mistake.",
      "This page only shows the sections your own role can actually access — nothing here documents a feature you can't use.",
    ],
    note: "Zeno is built around one idea: the ledger is the hub. Every module — quotes, invoices, bills, payroll, assets — ultimately posts to the same double-entry ledger, so the system reads as one connected story, not a list of separate tools.",
  },
  {
    num: "02",
    title: "The Big Picture",
    subtitle: "How every part of Zeno connects",
    tags: ["Orientation", "Architecture"],
    rolesLabel: "Everyone",
    desc: "Money moves through Zeno in a predictable line. Understanding this flow once means every other section slots into a picture you already have.",
    concepts: [
      "Contact → Quote → Invoice. A quote is drafted against a customer, sent, and — once accepted — converted into an invoice with one click. Line items, tax and category headings carry across automatically.",
      "Invoice → Payment → Ledger. Recording a payment updates the invoice balance in real time and posts the receipt to Accounts Receivable and the paying account.",
      "Purchase Order → Bill → Payment. The mirror image on the spending side — a PO becomes a bill on receipt, a bill becomes a payment via Record payment, Pay via gateway, or a batched Payment Run.",
      "Payroll Run → Post to Ledger → Record Salary Payment. Posting accrues the liability only; a separate payment step clears it against a real account — cash never moves until that second step.",
      "Everything ends up in Accountant. Every document above posts a real double-entry journal entry — nothing in Reports or Analytics is calculated separately.",
    ],
    seeAlso: ["05", "07", "08", "13", "16"],
  },
  {
    num: "03",
    title: "Roles & What Each One Sees",
    tags: ["Admin", "Orientation"],
    perm: "staff",
    rolesLabel: "Admin / Owner",
    desc: "Every staff account has exactly one role, and every role has a fixed list of modules it can see. The sidebar isn't the same for everyone — that's intentional.",
    concepts: [
      "Six built-in roles ship with Zeno: Admin (owner), Accountant, Sales, HR, Inventory, and Staff — plus any custom role an admin creates.",
      "Staff is deliberately narrow: self-service only — Home, Expense Claims, Leave Requests — and almost nothing else. That's the point, not an oversight.",
      "Admins can toggle exactly which modules any role — built-in or custom — can see, per organization, from Staff & Roles.",
      "The owner account always sees everything and can never be locked out, regardless of any toggle.",
    ],
    seeAlso: ["18"],
  },
  {
    num: "04",
    title: "Home Dashboard",
    tags: ["Operations", "Daily-use"],
    perm: "dashboard",
    rolesLabel: "Everyone",
    desc: "The first thing everyone sees on login — a live snapshot of the business, tuned to your role.",
    concepts: [
      "Admins and accountants see the full picture: money owed, cash across every account, money owed to vendors, VAT due to KRA, and a 6-month income vs. expense chart.",
      "Everyone else sees a narrower, personal view — their own assigned documents and tasks — when Data Segregation is on.",
      "A role without the Financials permission (the Marketer default) sees none of this — no KPI cards, no chart, no recent-invoices table — just the calendar and to-dos.",
      "A calendar surfaces upcoming due dates; a red banner surfaces anything overdue or needing attention today.",
    ],
    seeAlso: ["08", "15"],
  },
  {
    num: "05",
    title: "Customers & Vendors",
    subtitle: "Contacts",
    tags: ["Sales", "Spending", "Core-data"],
    perm: "contacts",
    rolesLabel: "Admin / Owner · Accountant · Sales · HR · Inventory · Marketer",
    desc: "One shared address book for everyone your business deals with — a contact can be a customer, a vendor, or both. Every quote, invoice, bill and credit note links back to a Contact here.",
    concepts: [
      "A contact's \"kind\" — customer, vendor, or both — decides which documents it can appear on.",
      "Every contact carries its own document history and account statement, plus an opening balance if you're migrating mid-year from another system.",
      "Vendors can save a default payout destination (M-Pesa, till, paybill) so bills don't require re-entering payment details every time.",
      "Source, Assigned to, and Next follow-up are non-financial CRM fields — the contacts list has a \"Follow up due\" filter that becomes a daily worklist. A role without the Financials permission (the Marketer default) can create and follow up with contacts here but never sees their balances, document totals, or profitability — those tabs simply don't appear.",
    ],
    seeAlso: ["07", "08", "10", "21"],
  },
  {
    num: "06",
    title: "Deals",
    tags: ["Sales", "CRM"],
    perm: "pipeline",
    rolesLabel: "Admin / Owner · Sales",
    desc: "A lightweight pipeline for tracking sales opportunities before they become a real quote or invoice.",
    concepts: [
      "Lead → qualified → proposal → negotiation → won/lost — a simple pipeline, not a full CRM.",
      "Entirely optional: you can quote or invoice a customer directly without ever creating a deal.",
    ],
    note: "Deals is deliberately kept separate and simple — it's for tracking a conversation, not for replacing the quote/invoice cycle itself.",
  },
  {
    num: "07",
    title: "Quotes & Quote Templates",
    tags: ["Sales", "Money"],
    perm: "quotes",
    rolesLabel: "Admin / Owner · Accountant · Sales",
    desc: "A quote is a formal, priced proposal for a customer. It can be drafted, sent, accepted, declined, or converted straight into an invoice.",
    concepts: [
      "Line items can be real catalog items, custom one-off lines, or category headings — a heading is a bold divider with no price, useful for grouping a quote into sections.",
      "Converting a quote preserves everything, including category headings, onto the resulting invoice.",
      "Quote Templates save a reusable layout — line items, notes, terms — so a common package doesn't have to be rebuilt from scratch every time.",
    ],
    steps: [
      { title: "Draft the quote", desc: "+ Create → Quote, pick the customer, add lines or a saved template." },
      { title: "Send it", desc: "Mark as sent once shared with the customer." },
      { title: "Convert once accepted", desc: "\"Convert to invoice →\" — every line, tax setting and heading carries straight across." },
    ],
    seeAlso: ["05", "08"],
  },
  {
    num: "08",
    title: "Invoices, Payments Received & Credit Notes",
    tags: ["Sales", "Money"],
    perm: "invoices",
    rolesLabel: "Admin / Owner · Accountant · Sales",
    desc: "Invoices are the billing document customers actually pay. Recording a payment updates its balance in real time; a credit note reverses part or all of one without deleting the record.",
    concepts: [
      "Every invoice line carries KRA-compliant VAT and is eTIMS-ready. Status moves Draft → Awaiting payment → Partly paid → Paid, or Overdue once the due date passes.",
      "Record payment logs money already received outside the app; Request via Gateway sends a real M-Pesa STK prompt straight to the customer's phone.",
      "A Credit Note can be raised even on an invoice that's already fully paid — that's the most common real reason to issue one. Status reads Available → Partly applied → Fully applied, never \"awaiting payment\".",
      "Payments Received lists every payment ever applied to an invoice, whether entered manually or captured through a gateway.",
    ],
    seeAlso: ["02", "05", "13"],
  },
  {
    num: "09",
    title: "Expenses & Expense Claims",
    tags: ["Spending"],
    perm: ["expenses", "expense_claims"],
    rolesLabel: "Admin / Owner · Accountant · Inventory · Everyone (claims)",
    desc: "Everything money going out immediately, plus reimbursements for staff who pay out of pocket.",
    concepts: [
      "An Expense is paid immediately from a bank/M-Pesa/cash account, tagged with a category. A Kopo Kopo-routed till posts its flat transaction fee automatically alongside the expense.",
      "Expense Claims is the staff-facing side: any employee can file a claim with a receipt regardless of role — everyone in the org has this permission by default.",
      "Once approved, a claim is payable via Record payment or Pay via gateway, straight to the employee's M-Pesa number.",
    ],
    seeAlso: ["12", "15"],
  },
  {
    num: "10",
    title: "Bills & Purchase Orders",
    tags: ["Spending"],
    perm: ["bills", "purchase_orders"],
    rolesLabel: "Admin / Owner · Accountant · Inventory",
    desc: "A Bill is a vendor invoice you owe, paid later. A Purchase Order commits to buying before a bill even exists.",
    concepts: [
      "Every bill line needs a category — except a tracked-inventory item, which posts to Inventory Asset automatically instead of showing a category picker.",
      "A Purchase Order converts into a bill once goods/services are received — partial receipt is supported, so one PO can convert across more than one bill.",
      "Payment Runs batch-pay several outstanding bills together. Stuck Payouts (Gateway Payouts permission only) surfaces any gateway payout still pending confirmation.",
    ],
    seeAlso: ["05", "11"],
  },
  {
    num: "11",
    title: "Items, Stock & Warehouses",
    tags: ["Inventory", "Spending"],
    perm: "items",
    rolesLabel: "Admin / Owner · Accountant · Sales · Inventory",
    desc: "The catalog and stock ledger — everything your business sells or buys, with FIFO costing where tracking is on.",
    concepts: [
      "\"Track inventory\" turns on automatic quantity-on-hand and FIFO cost as an item moves through invoices, bills and transfers. It can only be switched on or off cleanly while on-hand quantity is zero.",
      "Multiple warehouses hold separate stock counts for the same item; Stock Transfers move quantity between them with its own record, distinct from a sale or purchase.",
    ],
    seeAlso: ["10", "13"],
  },
  {
    num: "12",
    title: "Bank & M-Pesa",
    tags: ["Money"],
    perm: "banking",
    rolesLabel: "Admin / Owner · Accountant",
    desc: "Every bank account, M-Pesa till and cash account, with reconciliation against real statements.",
    concepts: [
      "Reconciliation matches Zeno's booked transactions against a real statement's date and closing balance, line by line.",
      "A reconciliation left unfinished resumes exactly where it stopped — it never silently discards a freshly typed number for a stale one.",
      "Transfer between accounts moves money between your own accounts without it looking like income or an expense.",
    ],
    seeAlso: ["08", "13"],
  },
  {
    num: "13",
    title: "Accountant",
    subtitle: "The ledger underneath everything",
    tags: ["Money"],
    perm: "accountant",
    rolesLabel: "Admin / Owner · Accountant",
    desc: "The double-entry engine every other module posts to automatically. You'll rarely post directly here, except for a manual adjusting entry.",
    concepts: [
      "Chart of Accounts, journal entries, and Trial Balance live here, alongside Lock books, Cost centers, Uncategorized transactions and Budgets.",
      "Every account is one of five types — asset, liability, equity, income, expense — and that type can never change after creation.",
    ],
    seeAlso: ["08", "12", "15"],
  },
  {
    num: "14",
    title: "Fixed Assets",
    tags: ["Money"],
    perm: "fixed_assets",
    rolesLabel: "Admin / Owner · Accountant",
    desc: "Equipment, furniture, vehicles the business owns outright — plus intangible assets that amortize instead of depreciating.",
    concepts: [
      "Registering an asset without a paying account still saves it — marked \"Not recorded\" until \"Record purchase\" finishes posting it.",
      "Run Depreciation posts one period's straight-line entry at a time. Disposal (Sold, Scrapped, Traded in) asks which account received the proceeds.",
    ],
  },
  {
    num: "15",
    title: "Reports & Analytics",
    tags: ["Money", "Insights"],
    perm: "reports",
    rolesLabel: "Admin / Owner · Accountant · HR",
    desc: "Reports cover the standard accounting set — trial balance, P&L, VAT prep. Analytics adds a decision-making layer of charts.",
    concepts: [
      "Reports is the compliance layer — what you'd hand to an accountant or file with iTax (VAT3 mirrors what you'd file directly).",
      "P&L, Income vs Expense and Cost Center P&L can be filtered by business location, but only for lines actually tagged with one.",
      "Analytics is the decision layer — revenue trend, top customers, top items/services, and quote conversion rate — with no locked or paywalled cards.",
    ],
    seeAlso: ["13"],
  },
  {
    num: "16",
    title: "Payroll",
    subtitle: "Runs, employees, loans & advances",
    tags: ["HR", "Money"],
    perm: "payroll",
    rolesLabel: "Admin / Owner · HR",
    desc: "Staff payroll runs, statutory rules and tax, and staff loans/deductions — a self-contained module for organizations paying employees through Zeno.",
    concepts: [
      "PAYE, NSSF, SHIF and AHL calculate automatically from Rules & Tax, which carries an effective-from date so a mid-year statutory change never retroactively rewrites an already-run month.",
      "Posting is two deliberate steps: \"Post to Ledger\" accrues the liability only; \"Record Salary Payment\" — appearing once posted — asks which account the net pay actually left from and clears it. A run stays flagged NOT PAID until that second step.",
      "Loans is a longer-term staff loan recovered through payroll deductions over time. Salary Advances is the lighter, self-service version — a staff member can request one themselves, or a manager can issue one directly.",
    ],
    seeAlso: ["02", "12"],
  },
  {
    num: "17",
    title: "Recurring Templates",
    tags: ["Money", "Automation"],
    perm: "invoices",
    rolesLabel: "Admin / Owner · Accountant",
    desc: "Set an invoice or bill to regenerate automatically on a schedule instead of re-entering it every cycle.",
    concepts: [
      "Due date can be a flat number of days, or a genuine \"due at end of next month\" calendar rule — not a coincidence of the day-count picked.",
      "\"Issue automatically\" sends it the moment it's generated; leave it off and it's created as a draft for review first.",
    ],
    seeAlso: ["08"],
  },
  {
    num: "18",
    title: "Staff & Roles",
    subtitle: "Who can see what",
    tags: ["Admin"],
    perm: "staff",
    rolesLabel: "Admin / Owner",
    desc: "Where an admin creates staff accounts, assigns roles, and — critically — controls exactly which modules each role can see.",
    concepts: [
      "Toggling a module for a role applies to everyone with that role, immediately — the permission matrix here is the literal source of truth for every sidebar item everyone in the org sees.",
      "Data Segregation (Settings) restricts staff to only documents assigned to them; the \"View org-wide documents\" permission grants a specific role full visibility even with segregation on.",
    ],
    seeAlso: ["03"],
  },
  {
    num: "19",
    title: "Settings & Billing",
    tags: ["Admin"],
    perm: "settings",
    rolesLabel: "Admin / Owner",
    desc: "Org-wide configuration: company profile and branding, billing, payment gateways, and document numbering.",
    concepts: [
      "Business Identity carries what appears on every document: name, logo, brand color, KRA PIN, invoice/quote numbering, footer/terms text.",
      "Billing shows the org's own trial/active status — \"Pay now\" only enables once the fee is actually due, to avoid paying twice by mistake.",
      "Payment Gateways connects M-Pesa Daraja or Kopo Kopo for automated, matched inbound payments — no manual reconciliation needed for gateway traffic.",
    ],
    seeAlso: ["18"],
  },
  {
    num: "20",
    title: "End-to-End Walkthroughs",
    tags: ["Orientation", "Workflows"],
    rolesLabel: "Everyone",
    desc: "Three complete stories, start to finish, tying every section above into one continuous flow.",
    concepts: [
      "A sale, start to finish: a customer asks for pricing → Sales drafts a Quote → it's sent and accepted → Convert to invoice → customer pays via M-Pesa STK → payment posts to the ledger automatically → a Credit Note can still be raised later if a refund is needed, even though it's fully paid.",
      "A purchase, start to finish: Inventory raises a Purchase Order → vendor delivers, partially or fully → Convert to bill → Accountant records payment or batches it into a Payment Run.",
      "A payroll cycle, start to finish: HR runs payroll for the month → PAYE/NSSF/SHIF/AHL calculate from Rules & Tax → Post to Ledger accrues the liability → Record Salary Payment clears it — the run flips from NOT PAID to PAID.",
    ],
    seeAlso: ["02", "07", "08", "10", "16"],
  },
  {
    num: "21",
    title: "Campaigns",
    tags: ["Sales", "Marketing"],
    perm: "campaigns",
    rolesLabel: "Admin / Owner · Marketer",
    desc: "Send a bulk SMS to everyone in a customer group — turns the SMS provider you configure in Settings → SMS into an actual outreach tool.",
    concepts: [
      "Pick a customer group (Contacts → Groups) and write a message — saved as a draft first, nothing sends until you click Send now.",
      "Sending loops every contact in the group who has a phone number on file and records each one's result — sent or failed — so a failure is diagnosable per contact, not just a lower total.",
      "SMS only for now — there's no programmatic WhatsApp sending (only the static click-to-chat link elsewhere in the app) and no email campaigns yet.",
    ],
    seeAlso: ["05"],
  },
  {
    num: "22",
    title: "Getting Help",
    tags: ["Orientation"],
    rolesLabel: "Everyone",
    desc: "This page only shows sections your role can actually access, and always reflects the live system. The downloadable PDF (above) documents every module for reference, including ones your role may not have — if something here doesn't match the PDF, this page is the current one.",
    concepts: [
      "Settings → Support, reachable from the sidebar at every stage, has direct Call and WhatsApp buttons plus a FAQ.",
    ],
  },
];

export default async function DocsPage() {
  const access = await getAccess();
  const perms = access?.perms;
  const isAdmin = access?.role === "admin";

  const visible = SECTIONS.filter((s) => {
    if (!s.perm) return true;
    if (isAdmin) return true;
    if (!perms) return false;
    const required = Array.isArray(s.perm) ? s.perm : [s.perm];
    return required.some((p) => perms.has(p));
  });

  const hiddenCount = SECTIONS.length - visible.length;

  return (
    <div className="space-y-10 pb-12">
      {/* Hero */}
      <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand)]/10 to-transparent">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand)]/5 blur-3xl rounded-full" />
        <div className="relative z-10 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 5.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            System Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Every module, every role, <br className="md:hidden" /> start to finish
          </h1>
          <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto">
            {hiddenCount > 0
              ? `Showing what your role can see — ${visible.length} of ${SECTIONS.length} sections. An admin can adjust this in Staff & Roles.`
              : "The complete guide, tuned to what your role can access."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="/docs/zeno-system-guide.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-ink-900)] hover:bg-black text-white text-[13px] font-medium px-5 py-2.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download PDF
            </a>
            <a
              href="/settings/support"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-ink-200)] hover:border-[var(--color-brand)] text-[13px] font-medium text-[var(--color-ink-600)] hover:text-[var(--color-brand)] px-5 py-2.5"
            >
              Go to Support
            </a>
          </div>
        </div>
      </div>

      {/* Quick nav */}
      <div className="max-w-3xl mx-auto px-4 flex flex-wrap justify-center gap-2">
        {visible.map((s) => (
          <a
            key={s.num}
            href={`#sec-${s.num}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-ink-200)] hover:border-[var(--color-brand)] text-[12px] font-medium text-[var(--color-ink-600)] hover:text-[var(--color-brand)] transition-colors"
          >
            <span className="text-[10px] font-bold text-[var(--color-ink-400)]">{s.num}</span>
            {s.title}
          </a>
        ))}
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {visible.map((s) => (
          <div key={s.num} id={`sec-${s.num}`} className="card p-6 scroll-mt-24">
            <div className="flex items-start gap-4">
              <div className="shrink-0 w-9 h-9 rounded-[10px] bg-[var(--color-ink-900)] text-white flex items-center justify-center text-[13px] font-bold">
                {s.num}
              </div>
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-[var(--color-ink-900)] tracking-tight">{s.title}</h2>
                {s.subtitle && <p className="text-[12px] text-[var(--color-ink-400)] mt-0.5">{s.subtitle}</p>}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {s.tags.map((t) => (
                    <span key={t} className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-500)] bg-[var(--color-ink-50)] border border-[var(--color-ink-100)] rounded px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="ml-[52px] mt-3.5">
              <p className="text-[13px] text-[var(--color-ink-600)] leading-relaxed">{s.desc}</p>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-3 mb-1">
                <span className="font-semibold text-[var(--color-ink-600)]">Roles</span> {s.rolesLabel}
              </p>

              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-400)] mt-4 mb-2">Key concepts</div>
              <ul className="space-y-1.5">
                {s.concepts.map((c, i) => (
                  <li key={i} className="text-[12.5px] text-[var(--color-ink-600)] leading-relaxed pl-3.5 relative">
                    <span className="absolute left-0 text-[var(--color-ink-300)]">—</span>
                    {c}
                  </li>
                ))}
              </ul>

              {s.steps && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-400)] mt-4 mb-2">Step by step</div>
                  <ul className="space-y-2">
                    {s.steps.map((st, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="shrink-0 w-[18px] h-[18px] mt-0.5 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] text-[10px] font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <div>
                          <div className="text-[12.5px] font-semibold text-[var(--color-ink-900)]">{st.title}</div>
                          <div className="text-[12px] text-[var(--color-ink-500)]">{st.desc}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {s.note && (
                <div className="mt-4 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-lg px-3.5 py-2.5">
                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-amber-800">Note</div>
                  <p className="text-[12px] text-amber-900/80 mt-1">{s.note}</p>
                </div>
              )}

              {s.seeAlso && s.seeAlso.length > 0 && (
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--color-ink-100)] flex-wrap">
                  <span className="text-[9.5px] font-bold uppercase tracking-wide text-[var(--color-ink-400)]">See also</span>
                  {s.seeAlso
                    .filter((n) => visible.some((v) => v.num === n))
                    .map((n) => (
                      <a
                        key={n}
                        href={`#sec-${n}`}
                        className="text-[10.5px] font-bold text-[var(--color-brand)] bg-[var(--color-brand)]/10 rounded px-2 py-0.5"
                      >
                        {n}
                      </a>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="card p-6 text-center">
          <div className="text-[14px] font-semibold text-[var(--color-ink-900)]">Didn't find what you needed?</div>
          <p className="text-[13px] text-[var(--color-ink-500)] mt-1 mb-4">Call or WhatsApp us directly — no ticket queue.</p>
          <a
            href="/settings/support"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5"
          >
            Go to Support
          </a>
        </div>
      </div>
    </div>
  );
}
