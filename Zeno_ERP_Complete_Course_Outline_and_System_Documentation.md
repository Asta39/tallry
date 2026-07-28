# 📚 ZENO ERP: COMPLETE SYSTEM REFERENCE & COURSE OUTLINE

> **Document Title**: Zeno ERP Complete System Mastery & Operating Manual  
> **Target Audience**: Business Owners, Financial Controllers, Accountants, Sales Managers, Operations Teams & Systems Administrators  
> **Regional Compliance**: Kenya & East Africa (Kenyan Shillings KES, KRA VAT 16%, PAYE Tiers, SHIF 2.75%, NSSF Tiers, Housing Levy 1.5%)  
> **Document Version**: 2.4 (Production Release)  
> **Scope**: 10 Core Operating Modules | 65+ Dedicated Routes & Screens | Complete Q2C, P2P, Payroll & GL Lifecycle  

---

## 📋 EXECUTIVE SUMMARY & CURRICULUM GOALS

**Zeno ERP** is a modern, enterprise-grade cloud ERP platform built specifically for fast-growing businesses in Kenya and East Africa. 

This manual serves as an exhaustive, screen-by-screen operating reference, functional map, learning objective index, and Standard Operating Procedure (SOP) guide across all 10 core system modules. Learners and operators will gain complete operational mastery over sales pipelines, multi-warehouse inventory, quote-to-cash operations, procure-to-pay automation, statutory Kenyan payroll, double-entry general ledger accounting, KRA VAT tax compliance, and super-admin multi-tenant controls.

---

## 📌 TABLE OF CONTENTS

1. [Module 1: Foundation, System Architecture & Business Onboarding](#module-1-foundation-system-architecture--business-onboarding)
2. [Module 2: Customer Relationship Management (CRM) & Sales Pipeline](#module-2-customer-relationship-management-crm--sales-pipeline)
3. [Module 3: Product Catalog, Multi-Warehouse Inventory & Stock Transfers](#module-3-product-catalog-multi-warehouse-inventory--stock-transfers)
4. [Module 4: Sales Operations, Invoicing & Revenue Management (Q2C)](#module-4-sales-operations-invoicing--revenue-management-q2c)
5. [Module 5: Procurement, Vendor Bills & Accounts Payable (P2P)](#module-5-procurement-vendor-bills--accounts-payable-p2p)
6. [Module 6: Kenyan Payroll Engine, Statutory Compliance & HR](#module-6-kenyan-payroll-engine-statutory-compliance--hr)
7. [Module 7: General Ledger, Asset Register & Financial Controls](#module-7-general-ledger-asset-register--financial-controls)
8. [Module 8: Financial Intelligence, Analytics & Tax Reporting](#module-8-financial-intelligence-analytics--tax-reporting)
9. [Module 9: Client Portal & Customer Self-Service](#module-9-client-portal--customer-self-service)
10. [Module 10: System Administration, Security & Multi-Tenancy](#module-10-system-administration-security--multi-tenancy)

---

## MODULE 1: Foundation, System Architecture & Business Onboarding

### Description
Establishes core system architecture, authentication security, organization multi-tenancy context, and initial business onboarding configuration.

### Key Learning Objectives
- Understand user authentication, security protocols, and session management.
- Configure business legal profiles, base currency (KES), KRA PINs, fiscal year, and brand colors.
- Master the global interface shell, desktop/mobile navigation menus, and keyboard shortcuts (`Cmd+K`).

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `(auth)/login` & `(auth)/signup` | Authentication Portal | Secure user registration, password authentication, and session cookie initialization. |
| `(auth)/forgot-password` & `update-password` | Account Recovery | Self-service password recovery flow via email token validation. |
| `onboarding` | Organization Setup Wizard | Initial business setup: Legal Name, KRA PIN, Base Currency (KES), Fiscal Year, and Brand Colors. |
| `(app)/layout.tsx Shell` | Global Workspace Shell | Primary UI layout: Sidebar Navigation, Global Search (`Cmd+K`), Impersonation Banner, and Notifications. |

```
Core Operating Workflow:
User Registration → Security Verification → Organization Provisioning → Global Workspace Access
```

---

## MODULE 2: Customer Relationship Management (CRM) & Sales Pipeline

### Description
Manages customer and vendor directories, contact credit limits, customer account statements, and visual Kanban sales pipelines.

### Key Learning Objectives
- Master contact creation with proper tax classification (Customer vs. Vendor).
- Generate custom customer account statements for debt collection and audit reconciliation.
- Track high-value deal opportunities using visual Kanban opportunity stages.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/contacts` | Contacts Master Directory | Searchable, filterable list of all customers and vendors with live balance metrics. |
| `/contacts/new` | Contact Registration Form | Detailed contact entry: KRA PIN, Email, Phone, Payment Terms, Bank Details, and Billing/Shipping Addresses. |
| `/contacts/[id]` | Contact Profile & History | 360-degree contact view displaying open invoices, payments, quotes, and activity history. |
| `/contacts/[id]/statement` | Customer Statement Generator | Custom date-range statement generator exporting PDF account balances for customer reconciliation. |
| `/pipeline` | Kanban Sales Pipeline | Interactive drag-and-drop CRM deal board tracking opportunity stages, deal values, and closing dates. |

```
Core Operating Workflow:
Lead Generation → Opportunity Tracking (Pipeline) → Contact Profiling → Credit Limit Assignment
```

---

## MODULE 3: Product Catalog, Multi-Warehouse Inventory & Stock Transfers

### Description
Oversees physical goods and service items, multi-location warehouse management, inventory reorder points, and stock movement logs.

### Key Learning Objectives
- Distinguish between physical Inventory Goods and intangible Services.
- Configure multiple warehouse locations with custom bin IDs and capacity limits.
- Execute inter-warehouse stock transfer orders with real-time audit trail verification.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/items` | Items & Services Directory | Master list of products and services, stock on hand, purchase costs, and sales prices. |
| `/items/new` | Item Creation Form | Configures SKU, Item Name, Type (Goods/Service), Unit Price, Purchase Price, Income/Expense GL, and Initial Stock. |
| `/items/warehouses` | Warehouse Directory | List of all physical storage locations, distribution centers, and storage capacity metrics. |
| `/items/warehouses/[id]` | Warehouse Bin Inspection | Location-specific inventory list, bin numbers, and localized stock valuation. |
| `/items/transfers` | Stock Transfer Management | Creates and tracks stock movement between warehouses, updating localized inventory balances in real time. |

```
Core Operating Workflow:
Item Definition → Stock Intake / Receiving → Multi-Warehouse Allocation → Stock Transfer Order Execution
```

---

## MODULE 4: Sales Operations, Invoicing & Revenue Management (Q2C)

### Description
Covers the end-to-end Quote-to-Cash (Q2C) lifecycle, customized document templates, M-Pesa payment recording, credit notes, and recurring retainers.

### Key Learning Objectives
- Draft professional sales quotes and convert them seamlessly to binding invoices.
- Apply accurate Kenyan VAT tax classes (B16 Standard 16%, Exempt, Zero-Rated).
- Log manual customer payments (M-Pesa, Wire, Cash) and issue credit notes for sales returns.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/sales/quotes` | Quotations Directory | Status tracker for draft, sent, accepted, and declined customer quotes. |
| `/sales/quotes/new` & `/[id]/edit` | Quote Builder | Drafts estimates with line items, quantity, discounts, tax selection (B16), and custom terms. |
| `/sales/quote-templates` | Quote PDF Customizer | Designs visual PDF quotation templates with custom headers, colors, and legal disclaimers. |
| `/sales/invoices` | Invoices Master Hub | Comprehensive invoice list with status indicators (Paid, Overdue, Partial, Draft). |
| `/sales/invoices/new` & `/[id]` | Invoice Engine & View | Generates tax invoices, converts from quotes, prints formatted PDFs, and sends shareable client links. |
| `/sales/invoice-templates` | Invoice Branding Studio | Customizes tax invoice branding, payment instructions, bank details, and footer text. |
| `/sales/payments` | Payment Settlement Directory | Logs customer payments against outstanding invoices, updating invoice status to Paid. |
| `/sales/payments/events` | Gateway Event Log | Audit log of automated payment gateway webhooks (M-Pesa Express, KopoKopo, Card settlements). |
| `/sales/credit-notes` & `/new` | Credit Notes Directory | Manages customer returns, sales adjustments, and credit note issuance against invoices. |
| `/recurring` | Recurring Billing Schedules | Automates monthly/quarterly subscription invoicing schedules and retainer billing. |

```
Core Operating Workflow:
Quotation Issued → Customer Approval → Invoice Generation → Payment Receipt (M-Pesa/Bank) → Ledger Posting
```

---

## MODULE 5: Procurement, Vendor Bills & Accounts Payable (P2P)

### Description
Manages Purchase Orders, vendor bills, operational cash expenses, employee reimbursable claims, and automated bulk payment runs.

### Key Learning Objectives
- Issue official Purchase Orders to suppliers and track delivery status.
- Record vendor bills with input VAT tax credit claims.
- Process employee expense claims and execute automated bulk payment runs.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/purchases/orders` & `/new` | Purchase Orders Hub | Tracking supplier POs, approval statuses, and fulfillment progress. |
| `/purchases/orders/new` | PO Builder | Drafts purchase orders with vendor line items, expected delivery dates, and delivery addresses. |
| `/purchases/bills` & `/new` | Vendor Bills Directory | Accounts payable hub tracking supplier bills, due dates, and unpaid liability balances. |
| `/purchases/bills/new` & `/[id]` | Bill Entry & Detail View | Logs vendor bills, claims input VAT credits, attaches receipt attachments, and approves bills. |
| `/purchases/expenses` & `/new` | Expenses Directory | Tracks operational cash expenses (Fuel, Rent, Utilities, Office Supplies). |
| `/purchases/expenses/new` | Expense Entry Form | Logs direct expense payouts with GL account assignment, tax inclusion, and payment method. |
| `/expense-claims` | Employee Expense Claims | Portal for staff to submit out-of-pocket expense claims for manager review and reimbursement. |
| `/purchases/payment-runs` | Automated Payment Runs | Batch processing tool to select approved bills/expenses and execute bulk payouts. |

```
Core Operating Workflow:
PO Creation → Vendor Delivery → Bill Logging (Input VAT) → Manager Approval → Bulk Payment Run Settlement
```

---

## MODULE 6: Kenyan Payroll Engine, Statutory Compliance & HR

### Description
Implements full Kenyan statutory compliance (KRA PAYE tiers, SHIF 2.75%, NSSF Tiers, Housing Levy 1.5%), staff loans, timesheets, and monthly payslips.

### Key Learning Objectives
- Maintain complete employee profiles with statutory KRA, NSSF, and SHIF numbers.
- Configure statutory tax brackets, personal relief (KES 2,400/mo), and insurance relief.
- Execute monthly payroll runs, amortize staff loans, and export itemized payslips.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/payroll/employees` & `/new` | Employee Directory | Master roster of active, on-leave, and terminated staff members. |
| `/payroll/employees/[id]` | Employee Profile & Pay Terms | Configures basic salary, housing allowance, transport allowance, KRA PIN, NSSF ID, and SHIF ID. |
| `/payroll/rules` | Statutory Rule Engine | Defines tax formula parameters: PAYE bands, SHIF (2.75%), NSSF Tiers I & II, Housing Levy (1.5%). |
| `/payroll/loans` & `/new` | Staff Loans & Advances Hub | Tracks company loans granted to employees, interest rates, and automated monthly repayment schedules. |
| `/payroll/runs` | Payroll History & Launcher | Directory of past payroll runs and launcher for initiating new monthly payroll cycles. |
| `/payroll/runs/[id]` | Payroll Execution Studio | Computes gross-to-net salary breakdown, deductions, generates payslips, and posts payroll to GL. |
| `/time-tracking` | Timesheets & Attendance | Tracks hourly work logs, project time allocation, and billable employee hours. |

```
Core Operating Workflow:
Employee Seeding → Time Tracking / Loan Deductions → Payroll Engine Execution → Payslip Distribution → KRA/SHIF Remittance
```

---

## MODULE 7: General Ledger, Asset Register & Financial Controls

### Description
Enforces double-entry financial accounting, chart of accounts customization, manual journals, cost centers, fixed asset depreciation, and accounting period locks.

### Key Learning Objectives
- Navigate the Chart of Accounts structure (Assets, Liabilities, Equity, Revenue, Expense).
- Post balanced manual journal entries for accruals and reclassifications.
- Manage Fixed Asset depreciation schedules and enforce accounting period locks.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/accountant` | Chart of Accounts Master | Hierarchical structure of all financial accounts, account codes, and live balance metrics. |
| `/accountant/ledger/[id]` | General Ledger Detail View | Itemized debit and credit transaction history for any specific account code. |
| `/accountant/journals` & `/new` | Manual Journals Directory | Audit log of all manual accounting journal entries and reclassifications. |
| `/accountant/journals/new` | Journal Entry Builder | Drafts multi-line debit/credit journal entries with mandatory zero-variance balancing check. |
| `/accountant/cost-centers` | Cost Centers & Departments | Defines cost centers for departmental, regional, or project-based profitability tracking. |
| `/accounting/assets` & `/new` | Fixed Asset Register | Directory of company assets (Vehicles, Machinery, IT Equipment) with cost basis and book value. |
| `/accounting/assets/new` | Asset Acquisition & Depreciation | Registers new asset, selects depreciation method (Straight Line / Reducing Balance), and sets useful life. |
| `/accounting/budgets` & `/new` | Annual Budget Manager | Creates financial budgets per account and tracks month-by-month actual vs. budget variance. |
| `/accounting/drawings` | Owner Drawings & Equity | Logs equity withdrawals, capital injections, and partner dividend distributions. |
| `/accounting/period-lock` | Financial Period Lock Screen | Locks past accounting periods to prevent unauthorized editing of audited financial records. |
| `/banking` | Bank Accounts & Reconciliation | Monitors bank account balances, imports bank statements, and performs statement reconciliation. |

```
Core Operating Workflow:
Transaction Capture → Automated GL Posting → Manual Journal Adjustment → Period Lock Safeguard
```

---

## MODULE 8: Financial Intelligence, Analytics & Tax Reporting

### Description
Provides executive analytics, formal financial statements (P&L, Balance Sheet, Cash Flow), aging reports, and KRA VAT return filings.

### Key Learning Objectives
- Interpret Executive Analytics dashboards for business performance evaluation.
- Generate core financial statements (Profit & Loss, Balance Sheet, Cash Flow).
- Audit books health and export KRA-compliant VAT return filings (Output VAT vs Input VAT).

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/analytics` | Executive KPI Dashboard | Real-time visual charts: Revenue growth, gross margin ratios, top clients, and cash runway. |
| `/reports` | Master Reports Hub | Centralized launcher for all operational, financial, tax, and sales performance reports. |
| `/reports/pnl` | Profit & Loss Statement | Calculates net income by summarizing operating revenue, cost of goods sold (COGS), and expenses. |
| `/reports/balance-sheet` | Balance Sheet Statement | Snapshot of organization solvency: Total Assets = Total Liabilities + Equity. |
| `/reports/cash-flow` | Cash Flow Statement | Tracks cash inflows and outflows across Operating, Investing, and Financing activities. |
| `/reports/trial-balance` | Trial Balance & Books Health | Audit tool verifying that total debit balances equal total credit balances across all GL accounts. |
| `/reports/vat` & `/vat3` | KRA VAT Return Generator | Computes Output VAT charged on sales minus Input VAT paid on purchases for monthly KRA filing. |
| `/reports/aging` | AR & AP Aging Analysis | Categorizes outstanding debts into 0-30, 31-60, 61-90, and 90+ day overdue buckets. |
| `/reports/sales/*` | Detailed Sales Analytics | Granular reports: Sales by Customer, Sales by Item, Quote Conversion Rate, and Credit Note Summary. |

```
Core Operating Workflow:
Operational Data Collection → Trial Balance Verification → Financial Statement Generation → Tax Filing (KRA VAT)
```

---

## MODULE 9: Client Portal & Customer Self-Service

### Description
Enables customers to securely log in, view account statements, download invoices, track CRM deals, and access support documentation.

### Key Learning Objectives
- Configure and brand the customer self-service portal.
- Allow clients to review, accept estimates, and pay invoices online.
- Publish user guides and FAQs in the integrated Knowledge Base.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/portal/[orgSlug]/login` | Client Portal Login | Secure branded login interface for external clients and customers. |
| `/portal/[orgSlug]/(dashboard)/dashboard` | Customer Dashboard | Summary screen for clients displaying outstanding balance, total billed, and recent invoices. |
| `/portal/[orgSlug]/(dashboard)/documents` | Client Document Center | Client repository to view, print, and download PDF quotes, tax invoices, and payment receipts. |
| `/portal/[orgSlug]/(dashboard)/deals` | Client Project Tracker | Allows clients to view ongoing project milestones, deal stages, and deliverable timelines. |
| `/settings/knowledge-base` | Knowledge Base Studio | Admin editor to create, edit, and publish client help articles, guides, and FAQs. |
| `/portal/[orgSlug]/(dashboard)/knowledge` | Client Support Hub | Public-facing searchable help desk for customers to read documentation and FAQs. |

```
Core Operating Workflow:
Portal Provisioning → Client Account Activation → Online Document Access → Interactive Quote Acceptance
```

---

## MODULE 10: System Administration, Security & Multi-Tenancy

### Description
Empowers system administrators to manage global organization settings, payment gateways, subscription plans, super-admin security, and audit logs.

### Key Learning Objectives
- Configure M-Pesa Paybill/Till, KopoKopo, and SMS gateway credentials.
- Manage multi-tenant subscriptions, plan upgrades, and feature overrides.
- Utilize Super Admin Impersonation for debugging and review system audit trails.

### Screen-by-Screen Functional Map

| Route / Path | Screen Name | Key Features & Operating Responsibilities |
| :--- | :--- | :--- |
| `/settings` | General Org Settings | Updates organization legal name, tax registration number, logo, time zone, and default terms. |
| `/settings/payments` | Payment Gateway Config | Integrates M-Pesa Express, Paybill, Till Numbers, KopoKopo, and Credit Card processing keys. |
| `/settings/sms` | SMS Gateway Config | Configures SMS gateway credentials (e.g. Africa's Talking) for automated invoice/payment SMS notifications. |
| `/settings/billing` | Subscription & Billing | Displays current subscription tier (Free, Standard, Business), renewal dates, and usage limits. |
| `/admin` | Super Admin Center | Master dashboard for platform owners displaying total organizations, MRR revenue, and system health. |
| `/admin/orgs` & `/[id]` | Org Directory & Impersonation | List of all tenant organizations with 'Impersonate' trigger for remote administrative support. |
| `/admin/subscriptions` & `/revenue` | Subscription Revenue | Tracks platform monthly recurring revenue (MRR), subscription renewals, and payment history. |
| `/admin/audit` | Security Audit Log | Tamper-evident log tracking super-admin actions: impersonations, plan overrides, and admin management. |
| `/admin/health` & `/cron` | System Health & Cron Jobs | Monitors database connection pools, background cron jobs, automated billing cycles, and system uptime. |
| `/admin/announcements` | Announcements Studio | Publishes platform-wide notification banners visible to all logged-in organization users. |

```
Core Operating Workflow:
System Configuration → Gateway Integration → Subscription Monitoring → Audit Trail Review
```

---

## 📌 APPENDIX: SYSTEM SHORTCUTS & CONVENTIONS

- **Global Quick Search**: Press `Cmd+K` (macOS) or `Ctrl+K` (Windows) anywhere in the application to open instant navigation search across Contacts, Invoices, Bills, Quotes, and Reports.
- **Tax Classification Codes**:
  - `B16`: KRA Standard Rate 16% Output/Input VAT.
  - `EXEMPT`: Zero Tax (Exempted Goods & Services).
  - `ZERO`: 0% Tax (Exported Goods & Services).
- **Base Currency Formatting**: All standard amounts display in Kenyan Shillings (`KES 1,250.00`). Database values store standard monetary values in cents/integer balance precision.
