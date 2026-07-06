# Tallry — Product Spec (v1)

A Kenya-first accounting + light-ERP/CRM web app that behaves like Zoho Books inside
(double-entry ledger, quote-to-cash, procure-to-pay, FIFO inventory, KRA compliance)
but is drastically simpler to use, with an Apple-HIG-inspired design language.

## Stack

- **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4**
- **SQLite via Drizzle ORM + better-sqlite3** — zero-config local dev; schema is
  portable to Postgres/Supabase later.
- Server actions + route handlers for mutations; React Server Components for reads.
- PDF: server-rendered printable invoice view (print-to-PDF) in v1.
- QR: `qrcode` package for eTIMS verification QR.

## Modules (v1 scope)

1. **Dashboard** — cash position, receivables/payables, income vs expense chart, VAT due.
2. **Contacts** (unified CRM) — customers & vendors, contact persons, activity notes,
   simple sales pipeline (deal stages), financial rollups.
3. **Items** — services & inventory goods, FIFO lots, stock on hand, reorder alerts,
   eTIMS tax class per item.
4. **Sales** — Quotes → Invoices → Payments; Credit notes. VAT inclusive/exclusive,
   WHT on payments, printable eTIMS-style invoice with QR + CU number (simulated
   device, pluggable interface for real OSCU/VSCU later).
5. **Purchases** — Expenses, Bills, Vendor payments, Purchase orders.
6. **Banking** — bank/cash/M-Pesa accounts, manual + CSV import, categorization.
7. **Accountant** — Chart of Accounts (Kenyan seed), manual journals, general ledger.
8. **Reports** — P&L, Balance Sheet, Trial Balance, AR/AP aging, VAT return prep
   (output vs input VAT per class), WHT summary. CSV export everywhere.
9. **Settings** — one page, opinionated: org profile (KRA PIN, VAT no.), invoice
   numbering, tax rates, users later.

## Non-goals for v1

Multi-currency, payroll, multi-org, real bank feeds, real eTIMS device certification,
projects/timesheets. Schema leaves room for all of these.

## Design language ("Apple calm")

- SF-adjacent system font stack, generous whitespace, 12px radius cards, hairline
  borders, subtle translucent sidebar, one accent color (Kenya-green tinted blue),
  large friendly numerals for money.
- Plain business language first ("Money you're owed", not "Accounts Receivable");
  accountant terms shown as secondary labels.
- Global ⌘K/"+ New" quick-create. Max 2 clicks to any common action.
- Empty states teach the workflow.

## Key engineering decisions

- **Money as integer cents (KES).** No floats in the ledger.
- **Posting engine is the only writer to `journal_entries`.** Documents call
  `postDocument()`; voids post reversals. Ledger is append-only.
- **Tax engine** is a pure function: `computeDocumentTotals(lines, {inclusive, discount})`
  → per-line net/tax/gross + document totals, per-line rounding (eTIMS style).
- **eTIMS `TaxDevice` interface**: `sign(invoice) → {cuInvoiceNo, cuSerial, qrUrl, signature}`.
  v1 ships `SimulatedDevice`; a real OSCU/VSCU adapter slots in without schema change.
