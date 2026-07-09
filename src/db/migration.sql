-- Tallry — Postgres schema (Supabase)
-- Money columns are BIGINT integer cents. Idempotent.

CREATE TABLE IF NOT EXISTS org (
  id SERIAL PRIMARY KEY,
  user_id TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  kra_pin TEXT,
  vat_registered BOOLEAN NOT NULL DEFAULT TRUE,
  address TEXT, phone TEXT, email TEXT,
  logo_url TEXT,
  invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
  next_invoice_no INTEGER NOT NULL DEFAULT 1,
  next_quote_no INTEGER NOT NULL DEFAULT 1,
  invoice_template TEXT NOT NULL DEFAULT 'default',
  quote_template TEXT NOT NULL DEFAULT 'default',
  next_credit_note_no INTEGER NOT NULL DEFAULT 1,
  next_po_no INTEGER NOT NULL DEFAULT 1,
  next_payment_no INTEGER NOT NULL DEFAULT 1,
  cu_serial TEXT
);
-- Add auth columns to existing installs (idempotent)
ALTER TABLE org ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;
ALTER TABLE org ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE org ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#0f766e';
ALTER TABLE org ALTER COLUMN name SET DEFAULT '';


CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  company_name TEXT, email TEXT, phone TEXT, kra_pin TEXT,
  address TEXT, city TEXT, notes TEXT,
  is_withholding_agent BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'lead',
  expected_close TEXT, notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT, unit TEXT NOT NULL DEFAULT 'unit', description TEXT,
  sale_price_cents BIGINT NOT NULL DEFAULT 0,
  purchase_cost_cents BIGINT NOT NULL DEFAULT 0,
  tax_class TEXT NOT NULL DEFAULT 'B16',
  sales_account_id INTEGER, purchase_account_id INTEGER,
  track_inventory BOOLEAN NOT NULL DEFAULT FALSE,
  reorder_level DOUBLE PRECISION NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS stock_lots (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL,
  remaining_qty DOUBLE PRECISION NOT NULL,
  unit_cost_cents BIGINT NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  number TEXT NOT NULL,
  contact_id INTEGER,
  date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  paid_cents BIGINT NOT NULL DEFAULT 0,
  source_doc_id INTEGER,
  journal_entry_id INTEGER,
  cu_invoice_number TEXT, cu_serial TEXT, qr_url TEXT,
  paid_from_bank_account_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_lines (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL,
  item_id INTEGER,
  description TEXT NOT NULL,
  qty DOUBLE PRECISION NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  tax_class TEXT NOT NULL DEFAULT 'B16',
  tax_rate_bp INTEGER NOT NULL DEFAULT 1600,
  net_cents BIGINT NOT NULL DEFAULT 0,
  tax_cents BIGINT NOT NULL DEFAULT 0,
  gross_cents BIGINT NOT NULL DEFAULT 0,
  account_id INTEGER,
  cogs_cents BIGINT NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL,
  direction TEXT NOT NULL,
  contact_id INTEGER,
  document_id INTEGER,
  date TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  wht_cents BIGINT NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'mpesa',
  bank_account_id INTEGER,
  reference TEXT,
  journal_entry_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  bank_account_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uncategorized',
  category_account_id INTEGER,
  journal_entry_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  memo TEXT,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  reversal_of_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  debit_cents BIGINT NOT NULL DEFAULT 0,
  credit_cents BIGINT NOT NULL DEFAULT 0,
  contact_id INTEGER,
  memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_doclines_doc ON document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_jlines_entry ON journal_lines(entry_id);
CREATE INDEX IF NOT EXISTS idx_jlines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_docs_type ON documents(type, status);
CREATE INDEX IF NOT EXISTS idx_lots_item ON stock_lots(item_id, date);

-- Multi-tenancy additions
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE items ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE document_lines ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS org_id INTEGER;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS org_id INTEGER;

ALTER TABLE stock_lots ADD COLUMN IF NOT EXISTS org_id INTEGER NOT NULL DEFAULT 1 REFERENCES org(id);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  role TEXT NOT NULL,
  perm_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(org_id, role, perm_key)
);
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  due_date TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0f766e',
  created_at TEXT NOT NULL
);

ALTER TABLE org ADD COLUMN IF NOT EXISTS custom_document_column_name TEXT;
ALTER TABLE org ADD COLUMN IF NOT EXISTS document_footer_text TEXT;

CREATE TABLE IF NOT EXISTS document_assignments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  doc_id INTEGER NOT NULL REFERENCES documents(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  member_id INTEGER NOT NULL REFERENCES members(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);

ALTER TABLE document_lines ADD COLUMN IF NOT EXISTS custom_column_value TEXT;
ALTER TABLE document_assignments ADD COLUMN IF NOT EXISTS assigned_by_id INTEGER;

ALTER TABLE org ADD COLUMN IF NOT EXISTS data_segregation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS external_ref TEXT;

CREATE TABLE IF NOT EXISTS categorization_rules (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  keyword TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'out',
  category_account_id INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_catrules_org ON categorization_rules(org_id, direction);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

-- PERFORMANCE INDEXES (ADDED FOR OPTIMIZATION)
CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id, kind);
CREATE INDEX IF NOT EXISTS idx_items_org ON items(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(org_id, type, status);
CREATE INDEX IF NOT EXISTS idx_documents_contact ON documents(contact_id);
CREATE INDEX IF NOT EXISTS idx_document_lines_org ON document_lines(org_id, document_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_org ON document_assignments(org_id, doc_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON bank_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_bank_txns_org ON bank_transactions(org_id, category_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_org ON journal_lines(org_id, entry_id, account_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id, document_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_org ON stock_lots(org_id, item_id);
CREATE INDEX IF NOT EXISTS idx_members_org ON members(org_id);

-- Phase A: reconciliation, recurring, books lock
ALTER TABLE org ADD COLUMN IF NOT EXISTS lock_date TEXT;
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS reconciliation_id INTEGER;

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  bank_account_id INTEGER NOT NULL,
  statement_date TEXT NOT NULL,
  statement_balance_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  completed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bank_recs_org ON bank_reconciliations(org_id, bank_account_id);

CREATE TABLE IF NOT EXISTS recurring_templates (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  contact_id INTEGER,
  paid_from_bank_account_id INTEGER,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_run_date TEXT NOT NULL,
  due_in_days INTEGER NOT NULL DEFAULT 30,
  tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
  auto_issue BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  lines_json TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recurring_org ON recurring_templates(org_id, active, next_run_date);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  name TEXT NOT NULL,
  asset_account_id INTEGER NOT NULL,
  depreciation_account_id INTEGER NOT NULL,
  expense_account_id INTEGER NOT NULL,
  purchase_date TEXT NOT NULL,
  purchase_cost_cents BIGINT NOT NULL,
  salvage_value_cents BIGINT NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  name TEXT NOT NULL,
  kra_pin TEXT,
  nssf_number TEXT,
  shif_number TEXT,
  basic_salary_cents BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  journal_entry_id INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payslips (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES org(id),
  payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  gross_pay_cents BIGINT NOT NULL,
  nssf_cents BIGINT NOT NULL,
  shif_cents BIGINT NOT NULL,
  housing_levy_cents BIGINT NOT NULL,
  paye_cents BIGINT NOT NULL,
  net_pay_cents BIGINT NOT NULL
);
