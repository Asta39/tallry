# Tallry vs QuickBooks — Gap Analysis & Bridge Plan

Where Tallry already matches QuickBooks, what's missing, and a phased plan to close
the gap — tuned for the Kenyan market (where Tallry can actually *beat* QuickBooks).

---

## What Tallry already has (matches QuickBooks Online "Simple Start / Essentials")

- Double-entry ledger, chart of accounts, manual journals, general ledger
- Customers & vendors (contacts) with statements-style history
- Quotes → invoices → payments; credit notes
- Expenses, bills, purchase orders (procure-to-pay)
- Items & inventory with FIFO costing + reorder alerts
- Bank & M-Pesa accounts, CSV + M-Pesa PDF import, learnable auto-categorization
- Reports: P&L, Balance Sheet, Trial Balance, Cash Flow, Aging (AR/AP), General Ledger,
  Sales, Income/Expense, VAT return
- Multi-user with roles & per-module permissions
- Branded invoice PDFs, dashboard with charts/todos/calendar
- **Kenya-native**: KRA VAT classes, WHT, eTIMS-ready, M-Pesa — QuickBooks does none of
  this well. This is the moat.

---

## The gaps (what makes people still buy QuickBooks)

### Tier 1 — table-stakes accounting people expect
1. **Bank reconciliation** — a proper "match statement to books, tick each line, confirm
   closing balance" workflow. We import + categorize but don't reconcile to a statement
   balance yet. **Highest priority** — it's the #1 accountant ritual.
2. **Recurring transactions** — auto-generate invoices/bills/expenses on a schedule
   (rent, retainers, subscriptions).
3. **Fixed assets & depreciation** — register assets, straight-line/reducing-balance
   depreciation, post monthly, track book value.
4. **Multi-currency** — invoice/bill in USD/EUR, exchange-rate gain/loss. (Common for
   Kenyan exporters/NGOs.)
5. **Bulk actions & better search** — multi-select invoices to send/print/reconcile.
6. **Audit trail** — who changed/voided what, when (partly there via journals; needs a
   user-facing log).

### Tier 2 — accounting depth
7. **Budgets vs actuals** — set a budget per account, report variance.
8. **Classes / projects / cost centers** — tag transactions to a project or department,
   report profitability per project (we have deals, not project accounting).
9. **Landed costs** — apportion freight/duty into inventory cost.
10. **Sales tax beyond VAT** — catering levy, tourism levy, excise (niche).
11. **Vendor/customer statements** — printable account statements (data exists; needs a
    statement document + email).
12. **Write-offs & bad debt** — one-click write off an uncollectible invoice.
13. **Owner's drawings / equity movements** UI.

### Tier 3 — the ecosystem that keeps people locked in
14. **Payroll** — PAYE, SHIF, NSSF, Housing Levy, payslips, P9 forms. Huge in Kenya;
    QuickBooks Kenya payroll is weak → real opportunity.
15. **Payments in/out** — M-Pesa Daraja / Kopo Kopo (already planned in PAYMENTS_PLAN.md).
16. **Email delivery** — send invoices/quotes/statements + reminders from the app.
17. **Customer portal** — clients view/pay their invoices online.
18. **Automated dunning** — overdue reminders on a schedule.
19. **Accountant access / books review** — invite your accountant, period lock/close.
20. **Attachments** — receipts/photos on expenses & bills (OCR later).
21. **API / integrations & data export** — QuickBooks/CSV export for migration in & out.

### Tier 4 — compliance & trust
22. **eTIMS live integration** (planned; gated off now).
23. **VAT-return filing helper / iTax export** — pre-fill the KRA VAT3 return.
24. **Period lock & year-end close** — freeze a closed period, roll retained earnings.
25. **Backups / data ownership** — export everything; reassure vs "cloud lock-in".

---

## Bridge plan — phased, highest ROI first

**Phase A — "a real accountant won't laugh at it"**
- Bank reconciliation workflow (statement balance → tick → confirm).
- Recurring invoices/bills/expenses (needs a scheduler — Vercel Cron).
- Vendor/customer statements (PDF + email).
- Bad-debt write-off + owner's drawings UI.
- Period lock / year-end close + retained-earnings roll.

**Phase B — "get paid & communicate"**
- Email delivery (Resend) — invoices, quotes, statements, receipts.
- Automated overdue reminders (dunning) on cron.
- Payment gateways (Daraja/Kopo Kopo) per PAYMENTS_PLAN.md — auto-record + status flip.
- Customer portal (view + pay invoice via a public tokenized link).

**Phase C — "depth that justifies a subscription"**
- Fixed assets + depreciation schedule.
- Budgets vs actuals.
- Projects / cost centers with profitability.
- Multi-currency.
- Attachments on expenses/bills.

**Phase D — "the Kenyan killer app"**
- Payroll (PAYE/SHIF/NSSF/Housing Levy, payslips, P9).
- eTIMS live (flip the built-in device to a real OSCU/reseller).
- VAT3 return pre-fill / iTax-ready export.
- Full data export/import + accountant invite.

---

## Honest positioning

Don't out-QuickBooks QuickBooks on generic accounting depth — win on **Kenya**:
M-Pesa reconciliation, KRA/eTIMS, WHT, payroll with local statutories, pay-by-paybill
auto-match, priced in KES. A Nairobi SMB doesn't need QuickBooks' 200 features; they need
the 30 that matter *here*, done cleanly. Phases A + B alone put Tallry ahead of QuickBooks
for most Kenyan small businesses. Phase D makes it a category they can't get elsewhere.

### Fastest single win for "why buy QuickBooks?"
Bank reconciliation (Phase A) + M-Pesa auto-match payments (Phase B). Once a business
owner sees payments land and reconcile themselves, QuickBooks' manual bank feed looks
worse — and Tallry costs less in KES.
