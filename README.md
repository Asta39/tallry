# Tallry

A Kenya-first accounting + CRM + light-ERP web app that works like Zoho Books on the
inside — double-entry ledger, quote-to-cash, procure-to-pay, FIFO inventory, KRA
compliance — but is radically simpler to use, with an Apple-HIG-inspired design.

## Run it

The database is Supabase Postgres. Put the connection string in `.env.local`
(use the **session pooler** URL, port 5432 — the direct `db.*` host is IPv6-only):

```
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

```bash
npm install
npm run db:push   # applies src/db/migration.sql to Supabase
npm run db:seed   # Kenyan chart of accounts + starter data (idempotent)
npm run dev       # http://localhost:3000
```

Tests: `npm test` (tax engine) · `npx tsx src/db/smoke.ts` (end-to-end posting smoke test)

## What's inside

| Area | What it does |
|---|---|
| **Home** | Cash, receivables, payables, VAT due — big quiet numbers |
| **Customers & Vendors** | Unified contacts with KRA PINs, activity notes, financial rollups |
| **Deals** | Simple sales pipeline (lead → won), the CRM piece |
| **Quotes → Invoices** | One-click conversion; invoices get eTIMS CU number + KRA QR (simulated device) |
| **Payments** | M-Pesa/bank/cash, with WHT withheld amounts tracked as a KRA receivable |
| **Expenses & Bills** | Direct spend and vendor credit; input VAT captured per line |
| **Items & Stock** | Services + goods, FIFO cost lots, reorder alerts, adjustments |
| **Bank & M-Pesa** | Money accounts, manual transactions, categorize-to-book |
| **Accountant** | Chart of accounts (Kenyan seed), manual journals, per-account ledger |
| **Reports** | P&L, Balance Sheet, Trial Balance, VAT 3 prep, Aging — all from the ledger, CSV export |

## Architecture (the Zoho lesson)

Everything is a journal. Documents (invoice/bill/expense/payment) are friendly editors
over one append-only double-entry ledger — `src/lib/posting.ts` is the only writer.
Reports never read document totals; they read the ledger, so they always reconcile.

- `src/lib/tax.ts` — pure Kenya VAT engine (16%/0%/exempt, inclusive/exclusive, per-line rounding)
- `src/lib/posting.ts` — posting rules for every document type; voids post reversals
- `src/lib/inventory.ts` — FIFO cost lots
- `src/lib/etims.ts` — `TaxDevice` interface; ships a **simulated** control unit. Swap in a
  real OSCU/VSCU adapter before fiscal use — printed invoices are watermarked as demo.
- `src/lib/reports.ts` — P&L, balance sheet, VAT return, aging, ledger queries
- Money is integer cents everywhere. SQLite via Drizzle (portable to Postgres).

See `docs/RESEARCH.md` (how Zoho Books works inside-out + KRA rules), `docs/SPEC.md`,
and `docs/DESIGN.md` (design reference lock).

## Not yet (v2 candidates)

Real eTIMS OSCU/VSCU integration, M-Pesa statement import (CSV mapping exists for bank
lines), multi-currency, payroll (PAYE/SHIF/NSSF accounts are pre-seeded), user accounts &
roles, purchase orders UI, credit note UI polish, email sending.
