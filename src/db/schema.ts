import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  doublePrecision,
  serial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * All money is stored as integer cents (KES). Quantities are doubles.
 * Every posted document links to a journal entry — the ledger is the truth.
 */

const money = (name: string) => bigint(name, { mode: "number" });

export const org = pgTable("org", {
  id: serial("id").primaryKey(),
  /** Supabase auth.users UUID — one org per user. */
  userId: text("user_id").unique(),
  name: text("name").notNull().default(""),
  /** Public customer-portal slug: zeno.com/p/<slug> */
  portalSlug: text("portal_slug").unique(),
  kraPin: text("kra_pin"),
  vatRegistered: boolean("vat_registered").notNull().default(true),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").notNull().default("#0f766e"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  invoiceTemplate: text("invoice_template").notNull().default("default"),
  quoteTemplate: text("quote_template").notNull().default("default"),
  nextInvoiceNo: integer("next_invoice_no").notNull().default(1),
  nextQuoteNo: integer("next_quote_no").notNull().default(1),
  nextCreditNoteNo: integer("next_credit_note_no").notNull().default(1),
  nextPoNo: integer("next_po_no").notNull().default(1),
  nextPaymentNo: integer("next_payment_no").notNull().default(1),
  cuSerial: text("cu_serial"), // eTIMS control unit serial (simulated in v1)
  customDocumentColumnName: text("custom_document_column_name"),
  documentFooterText: text("document_footer_text"),
  paymentInfoText: text("payment_info_text"),
  termsText: text("terms_text"),
  dataSegregation: boolean("data_segregation").notNull().default(false),
  /** Books lock: journal entries dated on/before this date are rejected. */
  lockDate: text("lock_date"),
  /** When on, posting a bill requires an accountant/admin to approve it first. */
  requireBillApproval: boolean("require_bill_approval").notNull().default(false),
  /** When on, staff see a clock-in/out card on their dashboard. */
  timeTrackingEnabled: boolean("time_tracking_enabled").notNull().default(false),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  // asset | liability | equity | income | expense
  type: text("type").notNull(),
  subtype: text("subtype").notNull().default("other"),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  /** Optional parent for chart-of-accounts hierarchy (self-reference). */
  parentAccountId: integer("parent_account_id"),
}, (t) => ({
  orgIdx: index("idx_accounts_org").on(t.orgId),
  orgCodeUnique: uniqueIndex("idx_accounts_org_code").on(t.orgId, t.code),
  parentIdx: index("idx_accounts_parent").on(t.parentAccountId),
}));

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  kind: text("kind").notNull(), // customer | vendor | both
  displayName: text("display_name").notNull(),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  kraPin: text("kra_pin"), // buyer PIN for eTIMS input-VAT claims
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  isWithholdingAgent: boolean("is_withholding_agent").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgKindIdx: index("idx_contacts_org").on(t.orgId, t.kind),
}));

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  contactId: integer("contact_id").notNull(),
  kind: text("kind").notNull(), // note | call | email | meeting
  content: text("content").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgContactIdx: index("idx_activities_org").on(t.orgId, t.contactId),
}));

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  plan: text("plan").notNull().default("free"), // free | standard | business
  status: text("status").notNull().default("active"), // active | expired
  paidUntil: text("paid_until").notNull(), // ISO date
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgUnique: uniqueIndex("idx_subscriptions_org").on(t.orgId),
}));

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  contactId: integer("contact_id").notNull(),
  title: text("title").notNull(),
  amountCents: money("amount_cents").notNull().default(0),
  // lead | qualified | proposal | negotiation | won | lost
  stage: text("stage").notNull().default("lead"),
  expectedClose: text("expected_close"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  kind: text("kind").notNull(), // service | goods
  name: text("name").notNull(),
  sku: text("sku"),
  unit: text("unit").notNull().default("unit"),
  description: text("description"),
  salePriceCents: money("sale_price_cents").notNull().default(0),
  purchaseCostCents: money("purchase_cost_cents").notNull().default(0),
  // eTIMS tax classes: B16 (16%), C0 (zero-rated), A_EXEMPT, D_NONVAT
  taxClass: text("tax_class").notNull().default("B16"),
  salesAccountId: integer("sales_account_id"),
  purchaseAccountId: integer("purchase_account_id"),
  trackInventory: boolean("track_inventory").notNull().default(false),
  reorderLevel: doublePrecision("reorder_level").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
}, (t) => ({
  orgIdx: index("idx_items_org").on(t.orgId),
}));

/** FIFO cost lots. Purchases append lots; sales consume remainingQty oldest-first. */
export const stockLots = pgTable("stock_lots", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  itemId: integer("item_id").notNull(),
  warehouseId: integer("warehouse_id").notNull(),
  date: text("date").notNull(),
  qty: doublePrecision("qty").notNull(),
  remainingQty: doublePrecision("remaining_qty").notNull(),
  unitCostCents: money("unit_cost_cents").notNull(),
  sourceType: text("source_type").notNull(), // bill | opening | adjustment | transfer
  sourceId: integer("source_id"),
}, (t) => ({
  orgItemIdx: index("idx_stock_lots_org").on(t.orgId, t.itemId),
  orgWarehouseIdx: index("idx_stock_lots_warehouse").on(t.orgId, t.warehouseId),
}));

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_warehouses_org").on(t.orgId),
}));

/** Move stock between warehouses at the same weighted-average cost — no GL impact, inventory stays the same asset. */
export const stockTransfers = pgTable("stock_transfers", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  itemId: integer("item_id").notNull(),
  fromWarehouseId: integer("from_warehouse_id").notNull(),
  toWarehouseId: integer("to_warehouse_id").notNull(),
  qty: doublePrecision("qty").notNull(),
  unitCostCents: money("unit_cost_cents").notNull(),
  date: text("date").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_stock_transfers_org").on(t.orgId),
}));

/**
 * Unified transactional documents.
 * type: quote | invoice | credit_note | bill | purchase_order | expense
 * status: draft | open | partial | paid | accepted | declined | closed | void
 */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  type: text("type").notNull(),
  number: text("number").notNull(),
  contactId: integer("contact_id"),
  date: text("date").notNull(),
  dueDate: text("due_date"),
  status: text("status").notNull().default("draft"),
  isTemplate: boolean("is_template").notNull().default(false),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  notes: text("notes"),
  subtotalCents: money("subtotal_cents").notNull().default(0),
  taxCents: money("tax_cents").notNull().default(0),
  totalCents: money("total_cents").notNull().default(0),
  paidCents: money("paid_cents").notNull().default(0),
  sourceDocId: integer("source_doc_id"), // quote → invoice lineage
  journalEntryId: integer("journal_entry_id"),
  // eTIMS fields (populated on invoice issue by the TaxDevice)
  cuInvoiceNumber: text("cu_invoice_number"),
  cuSerial: text("cu_serial"),
  qrUrl: text("qr_url"),
  // expense-specific: paid-from bank account
  paidFromBankAccountId: integer("paid_from_bank_account_id"),
  // set when a bill approval is rejected, shown back to the submitter
  approvalNote: text("approval_note"),
  // Snapshot of who created the document — survives staff renames/removal, shown on the PDF as "Sales Agent".
  createdByName: text("created_by_name"),
  createdByRole: text("created_by_role"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgTypeStatusIdx: index("idx_documents_org").on(t.orgId, t.type, t.status),
  contactIdx: index("idx_documents_contact").on(t.contactId),
}));

export const documentLines = pgTable("document_lines", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  documentId: integer("document_id").notNull(),
  itemId: integer("item_id"),
  description: text("description").notNull(),
  qty: doublePrecision("qty").notNull().default(1),
  unitPriceCents: money("unit_price_cents").notNull().default(0),
  discountPct: doublePrecision("discount_pct").notNull().default(0),
  taxClass: text("tax_class").notNull().default("B16"),
  taxRateBp: integer("tax_rate_bp").notNull().default(1600), // basis points ×100 = 16.00%
  netCents: money("net_cents").notNull().default(0),
  taxCents: money("tax_cents").notNull().default(0),
  grossCents: money("gross_cents").notNull().default(0),
  accountId: integer("account_id"), // income/expense account override
  cogsCents: money("cogs_cents").notNull().default(0), // FIFO cost consumed (audit)
  position: integer("position").notNull().default(0),
  customColumnValue: text("custom_column_value"),
  costCenterId: integer("cost_center_id"), // optional dimension tag, flows into the posted journal line
  warehouseId: integer("warehouse_id"), // stock location for tracked items; null = org's default warehouse
}, (t) => ({
  orgDocIdx: index("idx_document_lines_org").on(t.orgId, t.documentId),
}));

export const documentAssignments = pgTable("document_assignments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  documentId: integer("doc_id").notNull().references(() => documents.id),
  memberId: integer("member_id").notNull(), // can't reference members easily if it's below, we'll just store integer
  assignedById: integer("assigned_by_id"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgDocIdx: index("idx_document_assignments_org").on(t.orgId, t.documentId),
}));

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  number: text("number").notNull(),
  direction: text("direction").notNull(), // in (customer) | out (vendor)
  contactId: integer("contact_id"),
  documentId: integer("document_id"), // invoice or bill being settled
  date: text("date").notNull(),
  amountCents: money("amount_cents").notNull(), // gross amount applied to the document
  whtCents: money("wht_cents").notNull().default(0), // withheld income tax portion
  method: text("method").notNull().default("mpesa"), // mpesa | bank | cash | card | cheque
  bankAccountId: integer("bank_account_id"),
  reference: text("reference"),
  journalEntryId: integer("journal_entry_id"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgDocIdx: index("idx_payments_org").on(t.orgId, t.documentId),
}));

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // bank | mpesa | cash | card
  accountId: integer("account_id").notNull(), // linked COA asset account
  archived: boolean("archived").notNull().default(false),
}, (t) => ({
  orgIdx: index("idx_bank_accounts_org").on(t.orgId),
}));

export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  bankAccountId: integer("bank_account_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amountCents: money("amount_cents").notNull(), // signed: + money in
  status: text("status").notNull().default("uncategorized"), // uncategorized | categorized | reconciled
  categoryAccountId: integer("category_account_id"),
  journalEntryId: integer("journal_entry_id"),
  externalRef: text("external_ref"), // e.g. M-Pesa receipt code — used to dedupe imports
  reconciliationId: integer("reconciliation_id"), // set when ticked in a completed reconciliation
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgCategoryIdx: index("idx_bank_txns_org").on(t.orgId, t.categoryAccountId),
}));

/** Append-only ledger. Only src/lib/posting.ts writes here. */
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  date: text("date").notNull(),
  memo: text("memo"),
  sourceType: text("source_type").notNull(), // invoice | bill | payment | expense | manual | ...
  sourceId: integer("source_id"),
  reversalOfId: integer("reversal_of_id"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_journal_entries_org").on(t.orgId),
}));

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  entryId: integer("entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  debitCents: money("debit_cents").notNull().default(0),
  creditCents: money("credit_cents").notNull().default(0),
  contactId: integer("contact_id"),
  memo: text("memo"),
  costCenterId: integer("cost_center_id"), // optional dimension: department / project / location
}, (t) => ({
  orgEntryAccountIdx: index("idx_journal_lines_org").on(t.orgId, t.entryId, t.accountId),
  costCenterIdx: index("idx_journal_lines_cost_center").on(t.orgId, t.costCenterId),
}));

/* ---------------- Team, permissions, dashboard ---------------- */

/** Staff accounts. Org owner (org.userId) is implicit admin. */
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  userId: text("user_id").notNull().unique(), // Supabase auth uuid
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  // admin | accountant | sales | hr | inventory | staff
  role: text("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_members_org").on(t.orgId),
}));

/** Per-role module visibility, editable by admin. Missing row = role default. */
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  role: text("role").notNull(),
  permKey: text("perm_key").notNull(), // module key, e.g. "invoices"
  allowed: boolean("allowed").notNull().default(true),
});

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  title: text("title").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  color: text("color").notNull().default("#0f766e"),
  createdAt: text("created_at").notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  memberId: integer("member_id").references(() => members.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

/**
 * Learned bank categorization rules: "descriptions containing <keyword> →
 * book to <account>". Saved automatically when a user categorizes a
 * transaction, then applied to future imports. Editable by the user.
 */
export const categorizationRules = pgTable("categorization_rules", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  keyword: text("keyword").notNull(), // lowercase substring to match on description
  direction: text("direction").notNull().default("out"), // in | out
  categoryAccountId: integer("category_account_id").notNull(),
  hits: integer("hits").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

/* ---------------- Phase A: reconciliation & recurring ---------------- */

/**
 * A bank reconciliation session: tick imported/entered transactions until the
 * cumulative reconciled total equals the real statement balance, then complete.
 */
export const bankReconciliations = pgTable("bank_reconciliations", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  bankAccountId: integer("bank_account_id").notNull(),
  statementDate: text("statement_date").notNull(),
  statementBalanceCents: money("statement_balance_cents").notNull(),
  status: text("status").notNull().default("in_progress"), // in_progress | completed | cancelled
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  receiptNumber: text("receipt_number").notNull(),
  date: text("date").notNull(),
  amountCents: money("amount_cents").notNull(),
  phoneNumber: text("phone_number").notNull(),
  customerName: text("customer_name").notNull(),
  status: text("status").notNull().default("unmatched"), // unmatched | matched
  matchedPaymentId: integer("matched_payment_id"), // links to payments.id
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgReceiptIdx: uniqueIndex("idx_mpesa_transactions_receipt").on(t.orgId, t.receiptNumber),
}));

export const recurringTemplates = pgTable("recurring_templates", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  docType: text("doc_type").notNull(), // invoice | bill | expense
  contactId: integer("contact_id"),
  frequency: text("frequency").notNull(), // weekly | monthly | quarterly | yearly
  nextRunDate: text("next_run_date").notNull(),
  autoIssue: boolean("auto_issue").notNull().default(false), // skip draft state
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  linesJson: text("lines_json").notNull(), // serialized Array<DocLineInput>
  active: boolean("active").notNull().default(true),
  lastRunAt: text("last_run_at"),
  dueInDays: integer("due_in_days").notNull().default(30),
  paidFromBankAccountId: integer("paid_from_bank_account_id"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgNextRunIdx: index("idx_recurring_org_next").on(t.orgId, t.active, t.nextRunDate),
}));

export const fixedAssets = pgTable("fixed_assets", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  assetAccountId: integer("asset_account_id").notNull(),
  depreciationAccountId: integer("depreciation_account_id").notNull(),
  expenseAccountId: integer("expense_account_id").notNull(),
  purchaseDate: text("purchase_date").notNull(),
  purchaseCostCents: money("purchase_cost_cents").notNull(),
  salvageValueCents: money("salvage_value_cents").notNull().default(0),
  usefulLifeMonths: integer("useful_life_months").notNull(),
  depreciationMethod: text("depreciation_method").notNull().default("straight_line"),
  status: text("status").notNull().default("active"), // active | disposed
  createdAt: text("created_at").notNull(),
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  kraPin: text("kra_pin"),
  nssfNumber: text("nssf_number"),
  shifNumber: text("shif_number"),
  basicSalaryCents: money("basic_salary_cents").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const payrollRuns = pgTable("payroll_runs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  month: text("month").notNull(), // e.g. "2024-05"
  status: text("status").notNull().default("draft"), // draft | posted
  journalEntryId: integer("journal_entry_id"), // once posted
  createdAt: text("created_at").notNull(),
});

export const payslips = pgTable("payslips", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  payrollRunId: integer("payroll_run_id").notNull().references(() => payrollRuns.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  grossPayCents: money("gross_pay_cents").notNull(),
  nssfCents: money("nssf_cents").notNull(),
  shifCents: money("shif_cents").notNull(),
  housingLevyCents: money("housing_levy_cents").notNull(),
  payeCents: money("paye_cents").notNull(),
  netPayCents: money("net_pay_cents").notNull(),
});

export const statutoryRules = pgTable("statutory_rules", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  type: text("type").notNull(), // PAYE, SHIF, NSSF_1, NSSF_2, AHL, RELIEF
  effectiveFrom: text("effective_from").notNull(), // YYYY-MM-DD
  effectiveTo: text("effective_to"), // YYYY-MM-DD or null
  calculationType: text("calculation_type").notNull(), // banded, flat_percent, capped, flat_amount
  parametersJson: text("parameters_json").notNull(), // serialized parameters
  createdAt: text("created_at").notNull(),
});

export const payrollRunLineItems = pgTable("payroll_run_line_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  payrollRunId: integer("payroll_run_id").notNull().references(() => payrollRuns.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  type: text("type").notNull(), // gross_pay, deduction, addition, net_pay
  subType: text("sub_type"), // PAYE, SHIF, NSSF, AHL, loan, adjustment
  amountCents: money("amount_cents").notNull(), // absolute value
  isDeduction: boolean("is_deduction").notNull().default(false),
  statutoryRuleId: integer("statutory_rule_id").references(() => statutoryRules.id),
});

export const customRoles = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgNameIdx: uniqueIndex("idx_custom_roles_org_name").on(t.orgId, t.name),
}));

export const payrollAdjustments = pgTable("payroll_adjustments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  correctingRunId: integer("correcting_run_id").references(() => payrollRuns.id), 
  originalRunId: integer("original_run_id").references(() => payrollRuns.id), 
  amountCents: money("amount_cents").notNull(),
  isTaxable: boolean("is_taxable").notNull().default(true),
  isDeduction: boolean("is_deduction").notNull().default(false),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const loanLedger = pgTable("loan_ledger", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  principalCents: money("principal_cents").notNull(),
  balanceCents: money("balance_cents").notNull(),
  installmentCents: money("installment_cents").notNull(),
  type: text("type").notNull().default("amortizing"), // amortizing, recurring_fixed
  status: text("status").notNull().default("active"), // active, paid, paused
  createdAt: text("created_at").notNull(),
});

export const loanInstallments = pgTable("loan_installments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  loanId: integer("loan_id").notNull().references(() => loanLedger.id),
  payrollRunId: integer("payroll_run_id").notNull().references(() => payrollRuns.id),
  amountCents: money("amount_cents").notNull(),
  createdAt: text("created_at").notNull(),
});

export const leaveRecords = pgTable("leave_records", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  month: text("month").notNull(), // e.g. "2024-05"
  unpaidDaysCount: integer("unpaid_days_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const paymentGateways = pgTable("payment_gateways", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  gatewayId: text("gateway_id").notNull(), // mpesa_daraja, kopokopo
  enabled: boolean("enabled").notNull().default(false),
  environment: text("environment").notNull().default("sandbox"), // sandbox | production
  configJson: text("config_json"), // encrypted json string
  webhookSecret: text("webhook_secret"), // random token embedded in callback URLs
  c2bRegisteredAt: text("c2b_registered_at"), // when paybill C2B URLs were registered with Safaricom
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (t) => ({
  orgGatewayIdx: index("idx_payment_gateways_org").on(t.orgId, t.gatewayId),
}));

export const paymentEvents = pgTable("payment_events", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  gatewayId: text("gateway_id").notNull(),
  providerRef: text("provider_ref").notNull(),
  amountCents: money("amount_cents").notNull(),
  payerPhone: text("payer_phone"),
  payerName: text("payer_name"),
  accountRef: text("account_ref"),
  direction: text("direction").notNull().default("in"), // in (customer payment) | out (payout)
  status: text("status").notNull().default("received"), // pending | received | matched | unmatched | applied | failed | amount_mismatch
  matchedDocumentId: integer("matched_document_id"), // if matched to invoice
  paymentId: integer("payment_id"), // if applied (points to customer_payments)
  rawJson: text("raw_json"), // JSON payload from provider
  createdAt: text("created_at").notNull(),
}, (t) => ({
  gatewayRefUnique: uniqueIndex("idx_payment_events_gateway_ref").on(t.gatewayId, t.providerRef),
}));

export const receiptTokens = pgTable("receipt_tokens", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  paymentId: integer("payment_id").notNull().references(() => payments.id),
  token: text("token").notNull(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  tokenUnique: uniqueIndex("idx_receipt_tokens_token").on(t.token),
  paymentUnique: uniqueIndex("idx_receipt_tokens_payment").on(t.paymentId),
}));

export const smsSettings = pgTable("sms_settings", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  provider: text("provider").notNull().default("advanta"),
  enabled: boolean("enabled").notNull().default(false),
  configJson: text("config_json"), // encrypted: apiKey, partnerId, senderId
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (t) => ({
  orgUnique: uniqueIndex("idx_sms_settings_org").on(t.orgId),
}));

export const smsLog = pgTable("sms_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  paymentId: integer("payment_id"), // set for receipt SMS — dedupe key
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull(), // sent | failed
  providerRef: text("provider_ref"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  paymentUnique: uniqueIndex("idx_sms_log_payment").on(t.paymentId),
}));

export const portalOtps = pgTable("portal_otps", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  phone: text("phone").notNull(), // normalized 254XXXXXXXXX
  codeHash: text("code_hash").notNull(), // sha256(code + token pepper)
  attempts: integer("attempts").notNull().default(0),
  consumed: boolean("consumed").notNull().default(false),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgPhoneIdx: index("idx_portal_otps_org_phone").on(t.orgId, t.phone),
}));

export const reminderLog = pgTable("reminder_log", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  documentId: integer("document_id").notNull().references(() => documents.id),
  kind: text("kind").notNull(), // overdue_1 | overdue_7 | overdue_14
  sentAt: text("sent_at").notNull(),
}, (t) => ({
  docKindUnique: uniqueIndex("idx_reminder_log_doc_kind").on(t.documentId, t.kind),
}));

export const portalSessions = pgTable("portal_sessions", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  phone: text("phone").notNull(),
  token: text("token").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  tokenUnique: uniqueIndex("idx_portal_sessions_token").on(t.token),
}));

export const portalUsers = pgTable("portal_users", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  contactId: integer("contact_id").notNull().references(() => contacts.id),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgContactIdx: index("idx_portal_users_org_contact").on(t.orgId, t.contactId),
  emailUnique: uniqueIndex("idx_portal_users_email").on(t.orgId, t.email),
}));

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  published: boolean("published").notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_knowledge_articles_org").on(t.orgId),
}));

/** Platform super admins — global, not org-scoped. Env SUPER_ADMIN_EMAILS remains the bootstrap fallback. */
export const superAdmins = pgTable("super_admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  addedBy: text("added_by"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  emailUnique: uniqueIndex("idx_super_admins_email").on(t.email),
}));

/** Audit trail of super admin actions (impersonation, plan changes, admin management). */
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(), // impersonate_start | impersonate_stop | plan_change | paid_until_extend | super_admin_add | super_admin_remove
  targetType: text("target_type"), // org | super_admin
  targetId: text("target_id"),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  createdIdx: index("idx_admin_audit_created").on(t.createdAt),
}));

/** Platform-wide announcements shown as a banner in every tenant's app. */
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  tone: text("tone").notNull().default("info"), // info | warn
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
});

/** Execution history for scheduled jobs (recurring documents, due-date alerts). */
export const cronRuns = pgTable("cron_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(), // recurring | due-dates
  status: text("status").notNull(), // success | error
  detail: text("detail"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  jobCreatedIdx: index("idx_cron_runs_job_created").on(t.job, t.createdAt),
}));

/** Per-org boolean feature overrides — grants a plan-gated feature regardless of plan (beta/pilot tool). */
export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  flag: text("flag").notNull(), // gateways | sms | payouts | portal | recurring | payroll
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgFlagUnique: uniqueIndex("idx_feature_flags_org_flag").on(t.orgId, t.flag),
}));

/** Zeno's own subscription payments, collected via IntaSend STK push. */
export const billingPayments = pgTable("billing_payments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  plan: text("plan").notNull(), // standard | business
  cycle: text("cycle").notNull(), // monthly | annual
  amountCents: money("amount_cents").notNull(),
  phone: text("phone").notNull(),
  /** IntaSend invoice_id — used to poll status and match webhooks. */
  invoiceId: text("invoice_id"),
  state: text("state").notNull().default("PENDING"), // PENDING | PROCESSING | COMPLETE | FAILED | applied
  failedReason: text("failed_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
}, (t) => ({
  orgIdx: index("idx_billing_payments_org").on(t.orgId),
  invoiceUnique: uniqueIndex("idx_billing_payments_invoice").on(t.invoiceId),
}));

/** Staff-submitted expense claims for reimbursement — separate from vendor bills/expenses. */
export const expenseClaims = pgTable("expense_claims", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  memberId: integer("member_id"), // submitter — null if the owner themselves submitted
  submittedByName: text("submitted_by_name").notNull(),
  date: text("date").notNull(),
  categoryAccountId: integer("category_account_id").notNull(), // expense account to debit
  description: text("description").notNull(),
  amountCents: money("amount_cents").notNull(),
  receiptUrl: text("receipt_url"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | paid
  reviewedByName: text("reviewed_by_name"),
  reviewNote: text("review_note"),
  journalEntryId: integer("journal_entry_id"), // set on approval (DR expense · CR payable)
  paidJournalEntryId: integer("paid_journal_entry_id"), // set on payout (DR payable · CR bank)
  bankAccountId: integer("bank_account_id"), // set once paid
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
  paidAt: text("paid_at"),
}, (t) => ({
  orgStatusIdx: index("idx_expense_claims_org_status").on(t.orgId, t.status),
}));

/** Staff clock in/out shifts. */
export const timeShifts = pgTable("time_shifts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  memberId: integer("member_id"), // null = the org owner clocked in
  personName: text("person_name").notNull(),
  clockInAt: text("clock_in_at").notNull(), // ISO timestamp
  clockOutAt: text("clock_out_at"), // ISO timestamp, null while active
  durationSeconds: integer("duration_seconds"), // set on clock-out
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgOpenIdx: index("idx_time_shifts_org_open").on(t.orgId, t.clockOutAt),
  orgMemberIdx: index("idx_time_shifts_org_member").on(t.orgId, t.memberId),
}));

/** Reporting dimension: department / project / location tag on journal lines. */
export const costCenters = pgTable("cost_centers", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  code: text("code"),
  active: boolean("active").notNull().default(true),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_cost_centers_org").on(t.orgId),
}));

/** Batch vendor payment run — select open bills, pay them together from one bank account. */
export const paymentRuns = pgTable("payment_runs", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  date: text("date").notNull(),
  bankAccountId: integer("bank_account_id").notNull(),
  method: text("method").notNull().default("bank"), // mpesa | bank | cash | card | cheque
  status: text("status").notNull().default("draft"), // draft | posted
  totalCents: money("total_cents").notNull().default(0),
  createdAt: text("created_at").notNull(),
  postedAt: text("posted_at"),
}, (t) => ({
  orgIdx: index("idx_payment_runs_org").on(t.orgId),
}));

export const paymentRunItems = pgTable("payment_run_items", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  runId: integer("run_id").notNull().references(() => paymentRuns.id),
  billId: integer("bill_id").notNull(),
  amountCents: money("amount_cents").notNull(),
  paymentId: integer("payment_id"), // set once posted (points at the `payments` row created)
  status: text("status").notNull().default("pending"), // pending | paid | failed
  failReason: text("fail_reason"),
}, (t) => ({
  orgRunIdx: index("idx_payment_run_items_run").on(t.orgId, t.runId),
}));

/** A named budget for a fiscal year — one set of monthly targets per account. */
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  fiscalYear: text("fiscal_year").notNull(), // e.g. "2026"
  createdAt: text("created_at").notNull(),
}, (t) => ({
  orgIdx: index("idx_budgets_org").on(t.orgId),
}));

export const budgetLines = pgTable("budget_lines", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  budgetId: integer("budget_id").notNull().references(() => budgets.id),
  accountId: integer("account_id").notNull(),
  month: text("month").notNull(), // "2026-01"
  amountCents: money("amount_cents").notNull().default(0),
}, (t) => ({
  orgBudgetIdx: index("idx_budget_lines_budget").on(t.orgId, t.budgetId),
  budgetAccountMonthUnique: uniqueIndex("idx_budget_lines_unique").on(t.budgetId, t.accountId, t.month),
}));
