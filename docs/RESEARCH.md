# How Zoho Books Works — Inside Out

Reverse-engineered functional analysis of Zoho Books (accounting core + ERP/CRM edges),
plus the Kenyan regulatory layer (KRA, VAT, eTIMS, WHT). This is the source of truth
for the rebuild. We are not copying code or assets — we are re-implementing the same
*business behaviors* with a friendlier UX.

---

## 1. The core insight: everything is a journal

Zoho Books looks like ~15 modules (Invoices, Bills, Banking, Expenses...) but under the
hood it is **one double-entry general ledger**. Every user-facing document, when it
reaches a "posted" state, generates a balanced set of debit/credit lines against the
Chart of Accounts. The modules are just friendly editors for common journal patterns.

### Posting rules (what each document actually does)

| Document | Debit | Credit |
|---|---|---|
| Invoice (sent) | Accounts Receivable (gross) | Sales revenue (net) + VAT Output Payable (tax) |
| Invoice w/ inventory item | + Cost of Goods Sold (FIFO cost) | + Inventory Asset (FIFO cost) |
| Customer payment | Bank/Undeposited Funds | Accounts Receivable |
| Payment with WHT deducted | Bank (net) + WHT Receivable (withheld) | Accounts Receivable (gross) |
| Credit note | Sales revenue (net) + VAT Output (tax) | Accounts Receivable |
| Bill (vendor invoice) | Expense/Inventory Asset (net) + VAT Input Receivable | Accounts Payable |
| Vendor payment | Accounts Payable | Bank |
| Expense (direct) | Expense account (net) + VAT Input | Bank/Cash/Credit card |
| Inventory adjustment (−) | Inventory Adjustment expense | Inventory Asset |
| Manual journal | user-defined | user-defined (must balance) |

**Statuses gate posting.** A *draft* invoice posts nothing. Posting happens on
`draft → sent/open`. Voiding reverses (Zoho deletes the journal; proper systems post a
reversal — we post reversals for auditability).

### Document lifecycles (state machines)

- **Estimate/Quote:** draft → sent → accepted | declined | expired → (convert) invoice/sales order
- **Sales Order:** draft → confirmed → (partially) invoiced → closed
- **Invoice:** draft → sent(open) → partially_paid → paid | overdue (time-derived) | void
- **Purchase Order:** draft → issued → (partially) billed → closed
- **Bill:** draft → open → partially_paid → paid | overdue | void
- **Credit note:** draft → open → applied/refunded → closed

"Overdue" is not stored — it's derived: `status == open && due_date < today`.

## 2. Tax math (exactly how Zoho computes lines)

Each line item: `qty × rate = line_subtotal`, minus line discount (percent or fixed),
then an optional document-level discount (applied before or after tax per setting).

- **Tax-exclusive** (default): `tax = taxable_base × rate`; total = base + tax.
- **Tax-inclusive:** the entered rate contains tax: `net = amount × 100/(100+rate)`;
  tax = amount − net.
- Rounding: per-line tax computed and rounded at 2dp, then summed (Zoho lets you choose
  per-line vs per-total; per-line is what KRA eTIMS expects — eTIMS validates per-item tax).

Kenya tax rates to model:
- **VAT 16%** — standard rate on taxable goods/services (tax class B in eTIMS).
- **VAT 0%** — zero-rated (exports, some foodstuffs; class C). Taxable, so input VAT is claimable.
- **Exempt** — not VATable at all (class A). Input VAT NOT claimable, becomes cost.
- **Non-VAT / out of scope** (class D/E).

Registration threshold: KES 5M taxable turnover / 12 months. Below it: **Turnover Tax 3%**
(and no VAT). These determine which UX we surface at org setup.

### Withholding taxes (two different things — Zoho conflates them, we won't)

1. **Withholding Income Tax (WHT):** customer deducts e.g. 5% (professional fees,
   residents), 10%/20% (non-residents, varies) from the *net* and remits to KRA on your
   behalf. Books effect: payment received = gross − WHT; WHT posted to "WHT Receivable"
   (an asset — it's prepaid income tax).
2. **Withholding VAT (WHVAT) 2%:** appointed withholding agents withhold 2 percentage
   points of the 16% VAT on taxable supplies. Not applicable on zero-rated/exempt.

## 3. KRA eTIMS (electronic Tax Invoice Management System)

Every B2B/B2C sale by a registered taxpayer must be an electronic tax invoice,
transmitted to KRA in (near) real time via a control unit:
- **OSCU** — Online Sales Control Unit (KRA-hosted API, needs connectivity)
- **VSCU** — Virtual Sales Control Unit (locally installed, batches offline)

A compliant invoice must carry: seller KRA PIN, buyer PIN (if buyer will claim input
VAT), invoice serial number, date-time, item code/description/qty/unit/unit price,
tax rate & amount per item, gross total, **control unit invoice number (CU number)**,
control unit serial, internal data + receipt signature, and a **QR code** linking to
KRA's verification portal (`itax.kra.go.ke` verify URL + encoded invoice data).

Since Jan 2026 KRA's Income & Expense Validation Engine cross-checks tax returns
against eTIMS data automatically; expenses without eTIMS invoices are disallowed and
missing invoices attract a 2× tax penalty. So the clone must treat eTIMS fields as
first-class, not an afterthought: our invoice schema carries `cuInvoiceNumber`,
`cuSerial`, `qrUrl`, `buyerPin`, item tax classes — with a pluggable `TaxDevice`
interface so a real OSCU/VSCU integration can be dropped in later (v1 ships a
simulator that generates the CU fields locally and renders the QR).

## 4. The ERP edges

**Inventory:** FIFO cost lots. Each purchase (bill/opening stock) creates a lot
(qty, unit cost). Each sale consumes lots oldest-first → that consumption is the COGS
amount posted. Reorder level per item triggers a low-stock flag. Adjustments are
quantity (posts at FIFO cost) or value.

**Procure-to-pay:** PO (no accounting effect) → Bill (posts AP + expense/inventory) →
Vendor payment (clears AP). **Quote-to-cash:** Estimate → Sales Order (no posting) →
Invoice (posts) → Payment (clears AR).

**CRM side (Zoho CRM integration behaviors we absorb):** contacts hold both the
relationship data (persons, notes, activity timeline) and financial rollups
(receivables, unused credits). Deals/pipeline: lead → qualified → quote sent →
negotiation → won/lost; "won" auto-creates invoice. We build a lightweight pipeline
directly into the app rather than a separate CRM product.

**Banking:** accounts (bank/cash/card/M-Pesa), imported or manual transactions,
"categorize" = create the journal (expense/transfer/customer payment match),
reconciliation = tick transactions against statement balance.

## 5. Why users find Zoho Books hectic (the UX brief)

Common complaints we're designing against:
- Settings sprawl: dozens of preference pages before you can invoice.
- Accounting jargon up front (debits, ledgers) instead of business language.
- Deep navigation: 3–4 clicks to common actions; cluttered list toolbars.
- Modules feel disconnected (Books vs Inventory vs CRM are separate products).
- Tax setup is manual and error-prone.

Our answers: opinionated Kenya defaults (KES, 16% VAT preloaded, Kenyan COA seeded),
one unified app, a "New" quick-create anywhere, plain-language labels with accounting
detail available on demand, Apple-HIG-inspired calm visual design.

---

### Sources
- [Zoho Books API v3 — Introduction](https://www.zoho.com/books/api/v3/introduction/), [Invoices](https://www.zoho.com/books/api/v3/invoices/), [Bills](https://www.zoho.com/books/api/v3/bills/), [Journals](https://www.zoho.com/books/api/v3/journals/), [Credit Notes](https://www.zoho.com/books/api/v3/credit-notes/), [Sales Orders](https://www.zoho.com/books/api/v3/sales-order/), [Chart of Accounts](https://www.zoho.com/books/api/v3/chart-of-accounts/)
- [Zoho Books — Chart of Accounts help](https://www.zoho.com/us/books/help/accountant/chart-of-accounts.html), [Accounting features](https://www.zoho.com/us/books/accounting-software-features/), [Inventory add-on](https://www.zoho.com/us/books/help/items/advanced-inventory.html), [Inventory reports (FIFO lot tracking)](https://www.zoho.com/us/books/help/reports/inventory.html)
- [Zoho Inventory ↔ CRM integration](https://www.zoho.com/us/inventory/crm-integration/)
- [KRA — eTIMS](https://www.kra.go.ke/online-services/etims), [KRA — VAT](https://www.kra.go.ke/individual/filing-paying/types-of-taxes/value-added-tax)
- [Flick — E-invoicing in Kenya guide](https://www.flick.network/en-ke/e-invoicing-in-kenya), [Invoicemonk — eTIMS guide](https://invoicemonk.com/en/blog/e-invoicing-kenya-etims), [Veira — eTIMS 2026](https://veirahq.com/blog/etims-kenya)
- [PwC Tax Summaries — Kenya other taxes](https://taxsummaries.pwc.com/kenya/corporate/other-taxes), [Kenya withholding taxes](https://taxsummaries.pwc.com/kenya/corporate/withholding-taxes)
- [Alphacap — VAT Kenya guide](https://alphacap.co.ke/vat-kenya-guide/), [Withholding tax Kenya](https://alphacap.co.ke/withholding-tax-kenya/), [eTIMS compliance](https://alphacap.co.ke/etims-compliance-kenya/)
- [Zoho — Kenya VAT basics](https://www.zoho.com/ke/books/academy/taxes-and-compliance/kenya-vat-compliance.html)
