import { TRIAL_DAYS } from "@/lib/billing";

export const dynamic = "force-dynamic";

interface Topic {
  q: string;
  a: string;
}

interface Section {
  icon: string;
  title: string;
  intro: string;
  topics: Topic[];
}

const SECTIONS: Section[] = [
  {
    icon: "🏠",
    title: "Getting started",
    intro: `The first ${TRIAL_DAYS} days on Zeno are a full-access trial — every module below is unlocked from the moment you sign up, no credit card required.`,
    topics: [
      {
        q: "What happens when the trial ends?",
        a: "Access is paused until it's reactivated — every page is blocked and you're shown a single screen with Call/WhatsApp buttons to reach us. Reactivation is a one-time setup fee we record on our side; once that's done your account switches to Active and everything reopens immediately.",
      },
      {
        q: "What's the ongoing cost once active?",
        a: "A monthly maintenance fee based on your team size — KSh 1,000 per seat (you plus every staff member you've added) per month, shown on your Billing screen. It's not for \"unlocking\" anything — the modules you're paying for (CRM, Accounting, Payroll) stay on regardless of seat count — it's what keeps hosting, backups, KRA/eTIMS compliance updates and support running as your team grows.",
      },
      {
        q: "Who can I contact for help?",
        a: "Settings → Support, reachable from the sidebar at every stage (even a paused account), has direct Call and WhatsApp buttons plus a FAQ.",
      },
    ],
  },
  {
    icon: "🧾",
    title: "Sales — Quotes, Invoices, Credit Notes",
    intro: "The full customer-facing sales cycle: quote → invoice → payment, with credit notes for refunds/adjustments.",
    topics: [
      {
        q: "Quotes",
        a: "Draft a quote, send it, and the customer can accept or decline. An accepted quote can be converted straight into an invoice with one click — line items, tax and customer carry over automatically. Quote Templates let you save a reusable layout (line items, terms, footer) so repeat quotes don't have to be rebuilt from scratch.",
      },
      {
        q: "Invoices",
        a: "Every invoice line carries KRA-compliant VAT and is eTIMS-ready. Status moves through Draft → Awaiting payment → Partly paid → Paid, or Overdue once the due date passes. Invoice Templates work the same way as quote templates. Payments Received shows every payment applied against an invoice, whether entered manually or through a payment gateway.",
      },
      {
        q: "Credit Notes",
        a: "For refunds, returns, or correcting an invoice after the fact. Unlike an invoice, a credit note isn't something the customer owes you — it's a credit balance they can draw down against a future invoice. Its status reads Available → Partly applied → Fully applied, not \"awaiting payment\", since nothing is ever payable on a credit note.",
      },
      {
        q: "Recurring Templates",
        a: "Under Organization → Recurring Templates: set an invoice or bill to regenerate automatically on a schedule (weekly/monthly/etc.) instead of re-entering it every cycle.",
      },
    ],
  },
  {
    icon: "💸",
    title: "Spending — Expenses, Bills, Purchase Orders",
    intro: "Everything the business pays out, from a one-off cash expense to a full purchase-order-to-bill cycle.",
    topics: [
      {
        q: "Expenses",
        a: "A single payment out — pick the account it was paid from (bank, M-Pesa till, or cash/Petty Cash) and the expense category. If the paying account is a Kopo Kopo-routed M-Pesa till, the flat Kopo Kopo transaction fee is posted automatically alongside the expense so the ledger matches what actually left the till.",
      },
      {
        q: "Expense Claims",
        a: "For staff who pay for something out of pocket (or from petty cash) and need reimbursing. A staff member files a claim with a receipt; once approved it shows up for reimbursement. Reports → Petty Expenses gives the admin a day/week/month/all-time view of everything that moved through the Petty Cash account — both claimed and unattributed spend — for easy reconciliation.",
      },
      {
        q: "Bills & Purchase Orders",
        a: "Bills are vendor invoices you owe; Purchase Orders are what you send to a vendor before the bill arrives — a PO can be converted into a bill once goods/services are received. Payment Runs let you batch-pay several outstanding bills together instead of one at a time. Stuck Payouts (visible only with the Gateway Payouts permission) surfaces any gateway payout that didn't complete cleanly, so it can be retried or investigated.",
      },
    ],
  },
  {
    icon: "📦",
    title: "Items & Inventory",
    intro: "Stock tracking across one or more warehouses, with FIFO costing.",
    topics: [
      {
        q: "Items & Stock",
        a: "Each item can optionally have \"Track inventory\" turned on — once it does, quantity on hand and cost are tracked automatically as it moves through invoices, bills and transfers. An item can only be switched from tracked back to untracked (or vice-versa) cleanly while its on-hand quantity is zero.",
      },
      {
        q: "Warehouses & Stock Transfers",
        a: "Multiple warehouses can hold separate stock counts for the same item; Stock Transfers move quantity from one warehouse to another with its own record, separate from a sale or purchase.",
      },
    ],
  },
  {
    icon: "🏦",
    title: "Bank & M-Pesa",
    intro: "Every bank account, M-Pesa till, and cash account lives here, with reconciliation against real statements.",
    topics: [
      {
        q: "Reconciliation",
        a: "Start a reconciliation by entering the statement date and closing balance from your real bank/M-Pesa statement, then match it line-by-line against what's booked in Zeno. If a reconciliation is left unfinished, reopening the account and starting again reuses that session with your newly entered date/balance — it won't silently discard what you just typed and reuse stale numbers.",
      },
      {
        q: "Categorization rules",
        a: "When a transaction description contains a keyword you've booked to a specific account before, Zeno remembers and suggests the same account next time — visible under \"Saved categorization rules\" on the Banking page.",
      },
    ],
  },
  {
    icon: "🖥️",
    title: "Fixed Assets",
    intro: "A full asset register: equipment, furniture, vehicles — anything the business owns that depreciates over time — plus intangible assets that amortize instead.",
    topics: [
      {
        q: "Registering an asset",
        a: "Enter the asset, its cost, and which account it was paid from. If \"Paid from\" is left blank at registration, the asset is saved but not yet posted to the ledger — its row is marked \"Not recorded\" with a \"Record purchase\" action to finish posting it once you know the paying account.",
      },
      {
        q: "Depreciation & disposal",
        a: "Run depreciation from the Fixed Assets page — straight-line, one run posts the period's depreciation entry. Disposing of an asset asks how it left the business (Sold, Scrapped, or Traded in) and, for a sale or trade, which account the proceeds landed in; a scrapped asset has no proceeds to record.",
      },
      {
        q: "Intangible assets",
        a: "For things like software licenses or trademarks that amortize monthly instead of depreciating — tracked the same way, posting to Intangible Assets/Accumulated Amortization/Amortization Expense instead of the fixed-asset accounts.",
      },
    ],
  },
  {
    icon: "📈",
    title: "Reports",
    intro: "Every report reads from the same double-entry ledger, so the numbers always tie out.",
    topics: [
      {
        q: "Location / Cost Center reports",
        a: "Profit & Loss, Income vs Expense and Cost Center P&L can be filtered by business location (e.g. a branch or warehouse) — you'll be asked to pick a location before the report loads. This only works for lines that were tagged with a location when the invoice/bill/expense was entered; the underlying AR/AP/VAT/bank ledger lines are never location-tagged, so Balance Sheet, Trial Balance, Cash Flow and VAT/WHT reports are always org-wide.",
      },
      {
        q: "VAT & WHT",
        a: "VAT3 mirrors what you'd file with iTax; the dashboard's Payables card also shows accumulated VAT payable (output VAT minus input VAT) separately from the month-to-date net VAT figure. WHT covers withholding tax where applicable.",
      },
      {
        q: "Analytics",
        a: "A dashboard of charts — revenue trend, expense breakdown, business ratios and more — all reading real transaction data for the org, with no locked/paywalled cards.",
      },
    ],
  },
  {
    icon: "💵",
    title: "Payroll",
    intro: "Employees, statutory deductions, loans and salary advances.",
    topics: [
      {
        q: "Payroll Runs & Rules",
        a: "Run payroll for a period; PAYE, NSSF, SHIF and AHL are calculated per Rules & Tax settings. Employees holds each staff member's payroll record — pay rate, statutory numbers, and (optionally) which login account they map to for self-service.",
      },
      {
        q: "Loans vs Salary Advances",
        a: "Loans is for a longer-term staff loan the admin issues and recovers through payroll deductions over time. Salary Advances is a lighter-weight, self-service version — a staff member can request an advance themselves (if their role has the Salary Advances permission) and see their own request status/history; a manager can also issue one directly or approve/reject a pending request. Both recover the same way, through payroll deduction.",
      },
    ],
  },
  {
    icon: "🛡️",
    title: "Staff, Roles & Permissions",
    intro: "Every login belongs to a role, and every role's access to each module can be fine-tuned per organization.",
    topics: [
      {
        q: "Roles",
        a: "Admin (full access), Accountant (everything except staff management and settings), Sales, HR, Inventory, and Staff (self-service only: expense claims, leave requests, home). An admin can toggle any individual module on or off for a role in Staff & Roles, overriding the defaults.",
      },
      {
        q: "Data Segregation",
        a: "When turned on (Settings), staff without elevated access only see documents assigned to them, not the whole org's invoices/bills. The \"View org-wide invoices/documents\" permission lets an admin grant a specific role (Accountant, by default) full visibility even with segregation on, without making them a full admin.",
      },
      {
        q: "Leave Requests",
        a: "Staff can request leave themselves; \"Manage leave requests\" is a separate permission for approving/viewing everyone's requests, not just your own.",
      },
    ],
  },
  {
    icon: "📚",
    title: "Accountant / Ledger",
    intro: "The double-entry engine underneath every module — every invoice, bill, payment, payroll run and asset transaction posts here.",
    topics: [
      {
        q: "What lives here",
        a: "The Chart of Accounts, journal entries, and Trial Balance. Every other module (Sales, Spending, Banking, Payroll, Fixed Assets) writes to this ledger automatically — you generally won't post directly here except for manual adjusting entries.",
      },
    ],
  },
  {
    icon: "🎯",
    title: "Deals & Customer/Vendor management",
    intro: "Customers, vendors and the sales pipeline that leads to them.",
    topics: [
      {
        q: "Customers & Vendors",
        a: "A single contact record per customer or vendor, with a full document history (invoices, quotes, bills, credit notes) and account statement, and an opening balance if you're migrating from another system mid-year.",
      },
      {
        q: "Deals",
        a: "A lightweight pipeline (lead → qualified → proposal → negotiation → won/lost) for tracking sales opportunities before they become an invoice.",
      },
    ],
  },
  {
    icon: "💳",
    title: "Billing",
    intro: "Settings → Billing is where your own organization's account status and payments live.",
    topics: [
      {
        q: "Trial and maintenance fee",
        a: "Shows days left on trial, or your monthly maintenance fee and next due date once active. \"Pay now\" (M-Pesa STK push or card) only becomes available once the fee is actually due — it stays disabled before that to avoid paying twice by mistake.",
      },
      {
        q: "Payment history",
        a: "Every payment recorded against your account — whether you paid in-app or we recorded one manually — is listed here with its date, amount and status.",
      },
    ],
  },
];

export default async function DocsPage() {
  return (
    <div className="space-y-12 pb-12">
      {/* Hero */}
      <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand)]/10 to-transparent">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand)]/5 blur-3xl rounded-full" />
        <div className="relative z-10 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s4.332.477 5.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Documentation
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Everything Zeno does, <br className="md:hidden" /> in one place
          </h1>
          <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto">
            A module-by-module guide to what each screen does and how it fits together. Still stuck? Settings → Support has a direct line to us.
          </p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="max-w-3xl mx-auto px-4 flex flex-wrap justify-center gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.title}
            href={`#${s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-ink-200)] hover:border-[var(--color-brand)] text-[12.5px] font-medium text-[var(--color-ink-600)] hover:text-[var(--color-brand)] transition-colors"
          >
            <span>{s.icon}</span>
            {s.title}
          </a>
        ))}
      </div>

      {/* Sections */}
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {SECTIONS.map((s) => (
          <div key={s.title} id={s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="card p-6 scroll-mt-24">
            <div className="flex items-start gap-3">
              <span className="text-[22px] shrink-0">{s.icon}</span>
              <div className="min-w-0">
                <h2 className="text-[17px] font-bold text-[var(--color-ink-900)] tracking-tight">{s.title}</h2>
                <p className="text-[13px] text-[var(--color-ink-500)] mt-1">{s.intro}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 divide-y divide-[var(--color-ink-100)]">
              {s.topics.map((t) => (
                <details key={t.q} className="group py-3">
                  <summary className="flex items-center justify-between cursor-pointer text-[13.5px] font-semibold text-[var(--color-ink-900)] list-none">
                    {t.q}
                    <span className="text-[var(--color-ink-400)] transition-transform group-open:rotate-45 text-[16px] shrink-0 ml-3">+</span>
                  </summary>
                  <p className="mt-2 text-[13px] text-[var(--color-ink-500)] leading-relaxed">{t.a}</p>
                </details>
              ))}
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
