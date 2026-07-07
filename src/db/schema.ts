import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  doublePrecision,
  serial,
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
  kraPin: text("kra_pin"),
  vatRegistered: boolean("vat_registered").notNull().default(true),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  brandColor: text("brand_color").notNull().default("#0f766e"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  nextInvoiceNo: integer("next_invoice_no").notNull().default(1),
  nextQuoteNo: integer("next_quote_no").notNull().default(1),
  nextCreditNoteNo: integer("next_credit_note_no").notNull().default(1),
  nextPoNo: integer("next_po_no").notNull().default(1),
  nextPaymentNo: integer("next_payment_no").notNull().default(1),
  cuSerial: text("cu_serial"), // eTIMS control unit serial (simulated in v1)
  customDocumentColumnName: text("custom_document_column_name"),
  documentFooterText: text("document_footer_text"),
  dataSegregation: boolean("data_segregation").notNull().default(false),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  // asset | liability | equity | income | expense
  type: text("type").notNull(),
  subtype: text("subtype").notNull().default("other"),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
});

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
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  contactId: integer("contact_id").notNull(),
  kind: text("kind").notNull(), // note | call | email | meeting
  content: text("content").notNull(),
  date: text("date").notNull(),
  createdAt: text("created_at").notNull(),
});

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
});

/** FIFO cost lots. Purchases append lots; sales consume remainingQty oldest-first. */
export const stockLots = pgTable("stock_lots", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  itemId: integer("item_id").notNull(),
  date: text("date").notNull(),
  qty: doublePrecision("qty").notNull(),
  remainingQty: doublePrecision("remaining_qty").notNull(),
  unitCostCents: money("unit_cost_cents").notNull(),
  sourceType: text("source_type").notNull(), // bill | opening | adjustment
  sourceId: integer("source_id"),
});

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
  createdAt: text("created_at").notNull(),
});

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
});

export const documentAssignments = pgTable("document_assignments", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  documentId: integer("document_id").notNull().references(() => documents.id),
  memberId: integer("member_id").notNull(), // can't reference members easily if it's below, we'll just store integer
  assignedById: integer("assigned_by_id"),
  createdAt: text("created_at").notNull(),
});

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
});

export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // bank | mpesa | cash | card
  accountId: integer("account_id").notNull(), // linked COA asset account
  archived: boolean("archived").notNull().default(false),
});

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
  createdAt: text("created_at").notNull(),
});

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
});

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => org.id),
  entryId: integer("entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  debitCents: money("debit_cents").notNull().default(0),
  creditCents: money("credit_cents").notNull().default(0),
  contactId: integer("contact_id"),
  memo: text("memo"),
});

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
});

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
  memberId: integer("member_id").notNull().references(() => members.id),
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
