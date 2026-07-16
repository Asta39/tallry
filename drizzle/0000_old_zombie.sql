CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"subtype" text DEFAULT 'other' NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"date" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"account_id" integer NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"bank_account_id" integer NOT NULL,
	"statement_date" text NOT NULL,
	"statement_balance_cents" bigint NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"bank_account_id" integer NOT NULL,
	"date" text NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" text DEFAULT 'uncategorized' NOT NULL,
	"category_account_id" integer,
	"journal_entry_id" integer,
	"external_ref" text,
	"reconciliation_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"keyword" text NOT NULL,
	"direction" text DEFAULT 'out' NOT NULL,
	"category_account_id" integer NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"kind" text NOT NULL,
	"display_name" text NOT NULL,
	"company_name" text,
	"email" text,
	"phone" text,
	"kra_pin" text,
	"address" text,
	"city" text,
	"notes" text,
	"is_withholding_agent" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"title" text NOT NULL,
	"amount_cents" bigint DEFAULT 0 NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"expected_close" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"doc_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"assigned_by_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"item_id" integer,
	"description" text NOT NULL,
	"qty" double precision DEFAULT 1 NOT NULL,
	"unit_price_cents" bigint DEFAULT 0 NOT NULL,
	"discount_pct" double precision DEFAULT 0 NOT NULL,
	"tax_class" text DEFAULT 'B16' NOT NULL,
	"tax_rate_bp" integer DEFAULT 1600 NOT NULL,
	"net_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"gross_cents" bigint DEFAULT 0 NOT NULL,
	"account_id" integer,
	"cogs_cents" bigint DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"custom_column_value" text
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"type" text NOT NULL,
	"number" text NOT NULL,
	"contact_id" integer,
	"date" text NOT NULL,
	"due_date" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"notes" text,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"source_doc_id" integer,
	"journal_entry_id" integer,
	"cu_invoice_number" text,
	"cu_serial" text,
	"qr_url" text,
	"paid_from_bank_account_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"kra_pin" text,
	"nssf_number" text,
	"shif_number" text,
	"basic_salary_cents" bigint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"color" text DEFAULT '#0f766e' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"asset_account_id" integer NOT NULL,
	"depreciation_account_id" integer NOT NULL,
	"expense_account_id" integer NOT NULL,
	"purchase_date" text NOT NULL,
	"purchase_cost_cents" bigint NOT NULL,
	"salvage_value_cents" bigint DEFAULT 0 NOT NULL,
	"useful_life_months" integer NOT NULL,
	"depreciation_method" text DEFAULT 'straight_line' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"unit" text DEFAULT 'unit' NOT NULL,
	"description" text,
	"sale_price_cents" bigint DEFAULT 0 NOT NULL,
	"purchase_cost_cents" bigint DEFAULT 0 NOT NULL,
	"tax_class" text DEFAULT 'B16' NOT NULL,
	"sales_account_id" integer,
	"purchase_account_id" integer,
	"track_inventory" boolean DEFAULT false NOT NULL,
	"reorder_level" double precision DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"date" text NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" integer,
	"reversal_of_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"entry_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"debit_cents" bigint DEFAULT 0 NOT NULL,
	"credit_cents" bigint DEFAULT 0 NOT NULL,
	"contact_id" integer,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"month" text NOT NULL,
	"unpaid_days_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"loan_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"principal_cents" bigint NOT NULL,
	"balance_cents" bigint NOT NULL,
	"installment_cents" bigint NOT NULL,
	"type" text DEFAULT 'amortizing' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "mpesa_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"receipt_number" text NOT NULL,
	"date" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"phone_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"status" text DEFAULT 'unmatched' NOT NULL,
	"matched_payment_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"member_id" integer,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text DEFAULT '' NOT NULL,
	"portal_slug" text,
	"kra_pin" text,
	"vat_registered" boolean DEFAULT true NOT NULL,
	"address" text,
	"phone" text,
	"email" text,
	"logo_url" text,
	"brand_color" text DEFAULT '#0f766e' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV-' NOT NULL,
	"invoice_template" text DEFAULT 'default' NOT NULL,
	"quote_template" text DEFAULT 'default' NOT NULL,
	"next_invoice_no" integer DEFAULT 1 NOT NULL,
	"next_quote_no" integer DEFAULT 1 NOT NULL,
	"next_credit_note_no" integer DEFAULT 1 NOT NULL,
	"next_po_no" integer DEFAULT 1 NOT NULL,
	"next_payment_no" integer DEFAULT 1 NOT NULL,
	"cu_serial" text,
	"custom_document_column_name" text,
	"document_footer_text" text,
	"data_segregation" boolean DEFAULT false NOT NULL,
	"lock_date" text,
	CONSTRAINT "org_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "org_portal_slug_unique" UNIQUE("portal_slug")
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"gateway_id" text NOT NULL,
	"provider_ref" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"payer_phone" text,
	"payer_name" text,
	"account_ref" text,
	"direction" text DEFAULT 'in' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"matched_document_id" integer,
	"payment_id" integer,
	"raw_json" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"gateway_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"config_json" text,
	"webhook_secret" text,
	"c2b_registered_at" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"number" text NOT NULL,
	"direction" text NOT NULL,
	"contact_id" integer,
	"document_id" integer,
	"date" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"wht_cents" bigint DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'mpesa' NOT NULL,
	"bank_account_id" integer,
	"reference" text,
	"journal_entry_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"correcting_run_id" integer,
	"original_run_id" integer,
	"amount_cents" bigint NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"is_deduction" boolean DEFAULT false NOT NULL,
	"reason" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_run_line_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"type" text NOT NULL,
	"sub_type" text,
	"amount_cents" bigint NOT NULL,
	"is_deduction" boolean DEFAULT false NOT NULL,
	"statutory_rule_id" integer
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"journal_entry_id" integer,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"gross_pay_cents" bigint NOT NULL,
	"nssf_cents" bigint NOT NULL,
	"shif_cents" bigint NOT NULL,
	"housing_levy_cents" bigint NOT NULL,
	"paye_cents" bigint NOT NULL,
	"net_pay_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed" boolean DEFAULT false NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"phone" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipt_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"payment_id" integer NOT NULL,
	"token" text NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"name" text NOT NULL,
	"doc_type" text NOT NULL,
	"contact_id" integer,
	"frequency" text NOT NULL,
	"next_run_date" text NOT NULL,
	"auto_issue" boolean DEFAULT false NOT NULL,
	"tax_inclusive" boolean DEFAULT false NOT NULL,
	"lines_json" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" text,
	"due_in_days" integer DEFAULT 30 NOT NULL,
	"paid_from_bank_account_id" integer,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"document_id" integer NOT NULL,
	"kind" text NOT NULL,
	"sent_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"role" text NOT NULL,
	"perm_key" text NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"payment_id" integer,
	"phone" text NOT NULL,
	"message" text NOT NULL,
	"status" text NOT NULL,
	"provider_ref" text,
	"error" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"provider" text DEFAULT 'advanta' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config_json" text,
	"created_at" text NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "statutory_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"type" text NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"calculation_type" text NOT NULL,
	"parameters_json" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_lots" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"item_id" integer NOT NULL,
	"date" text NOT NULL,
	"qty" double precision NOT NULL,
	"remaining_qty" double precision NOT NULL,
	"unit_cost_cents" bigint NOT NULL,
	"source_type" text NOT NULL,
	"source_id" integer
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"paid_until" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"due_date" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_assignments" ADD CONSTRAINT "document_assignments_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_lines" ADD CONSTRAINT "document_lines_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_loan_id_loan_ledger_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_installments" ADD CONSTRAINT "loan_installments_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_ledger" ADD CONSTRAINT "loan_ledger_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_ledger" ADD CONSTRAINT "loan_ledger_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_transactions" ADD CONSTRAINT "mpesa_transactions_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_gateways" ADD CONSTRAINT "payment_gateways_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_correcting_run_id_payroll_runs_id_fk" FOREIGN KEY ("correcting_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_original_run_id_payroll_runs_id_fk" FOREIGN KEY ("original_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_line_items" ADD CONSTRAINT "payroll_run_line_items_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_line_items" ADD CONSTRAINT "payroll_run_line_items_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_line_items" ADD CONSTRAINT "payroll_run_line_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_run_line_items" ADD CONSTRAINT "payroll_run_line_items_statutory_rule_id_statutory_rules_id_fk" FOREIGN KEY ("statutory_rule_id") REFERENCES "public"."statutory_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_otps" ADD CONSTRAINT "portal_otps_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_tokens" ADD CONSTRAINT "receipt_tokens_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_tokens" ADD CONSTRAINT "receipt_tokens_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_log" ADD CONSTRAINT "reminder_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_rules" ADD CONSTRAINT "statutory_rules_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_org_id_org_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."org"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_org" ON "accounts" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_org_code" ON "accounts" USING btree ("org_id","code");--> statement-breakpoint
CREATE INDEX "idx_activities_org" ON "activities" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE INDEX "idx_bank_accounts_org" ON "bank_accounts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_bank_txns_org" ON "bank_transactions" USING btree ("org_id","category_account_id");--> statement-breakpoint
CREATE INDEX "idx_contacts_org" ON "contacts" USING btree ("org_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_custom_roles_org_name" ON "custom_roles" USING btree ("org_id","name");--> statement-breakpoint
CREATE INDEX "idx_document_assignments_org" ON "document_assignments" USING btree ("org_id","doc_id");--> statement-breakpoint
CREATE INDEX "idx_document_lines_org" ON "document_lines" USING btree ("org_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_documents_org" ON "documents" USING btree ("org_id","type","status");--> statement-breakpoint
CREATE INDEX "idx_documents_contact" ON "documents" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_items_org" ON "items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_journal_entries_org" ON "journal_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_journal_lines_org" ON "journal_lines" USING btree ("org_id","entry_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_articles_org" ON "knowledge_articles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_members_org" ON "members" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mpesa_transactions_receipt" ON "mpesa_transactions" USING btree ("org_id","receipt_number");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_events_gateway_ref" ON "payment_events" USING btree ("gateway_id","provider_ref");--> statement-breakpoint
CREATE INDEX "idx_payment_gateways_org" ON "payment_gateways" USING btree ("org_id","gateway_id");--> statement-breakpoint
CREATE INDEX "idx_payments_org" ON "payments" USING btree ("org_id","document_id");--> statement-breakpoint
CREATE INDEX "idx_portal_otps_org_phone" ON "portal_otps" USING btree ("org_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_portal_sessions_token" ON "portal_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_portal_users_org_contact" ON "portal_users" USING btree ("org_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_portal_users_email" ON "portal_users" USING btree ("org_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receipt_tokens_token" ON "receipt_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_receipt_tokens_payment" ON "receipt_tokens" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "idx_recurring_org_next" ON "recurring_templates" USING btree ("org_id","active","next_run_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reminder_log_doc_kind" ON "reminder_log" USING btree ("document_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sms_log_payment" ON "sms_log" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sms_settings_org" ON "sms_settings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_stock_lots_org" ON "stock_lots" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_subscriptions_org" ON "subscriptions" USING btree ("org_id");