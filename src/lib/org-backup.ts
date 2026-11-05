import { db, org } from "@/db";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "org-backups";

/** Every table that carries an org_id column, auto-derived from schema.ts at
 *  the time this was written (grep: `export const X = pgTable("Y", { ...
 *  orgId: integer("org_id") ...`). This is a hand-kept whitelist rather than
 *  a live schema introspection so a new org-scoped table doesn't silently
 *  start getting backed up (or, worse, a non-org-scoped table doesn't get
 *  fed a WHERE org_id clause it can't satisfy) without someone consciously
 *  adding it here. Keep in sync when adding tables with an org_id column. */
export const ORG_SCOPED_TABLES = [
  "accounts", "contacts", "customer_groups", "contact_group_memberships",
  "activities", "subscriptions", "deals", "items", "item_groups", "item_types",
  "stock_lots", "warehouses", "stock_transfers", "documents", "document_lines",
  "document_assignments", "payments", "bank_accounts", "bank_transactions",
  "journal_entries", "journal_lines", "members", "role_permissions", "todos",
  "events", "team_announcements", "notifications", "categorization_rules",
  "bank_reconciliations", "recurring_templates",
  "fixed_assets", "employees", "payroll_runs", "statutory_rules",
  "payroll_run_line_items", "custom_roles", "payroll_adjustments",
  "loan_ledger", "loan_installments", "leave_records", "payment_gateways",
  "payout_recipients", "payment_events", "receipt_tokens", "sms_settings",
  "sms_log", "portal_otps", "reminder_log", "approval_request_tokens",
  "expense_claim_payout_approvals", "portal_sessions", "portal_users",
  "knowledge_articles", "org_audit_log", "ai_messages", "feature_flags",
  "billing_payments", "expense_claims", "leave_requests", "time_shifts",
  "cost_centers", "payment_runs", "payment_run_items", "budgets", "budget_lines",
  "external_loans", "external_loan_repayments", "external_loan_interest_schedule",
  "loan_manual_repayments", "salary_advance_requests", "payroll_run_attendance",
  "item_boms", "campaigns", "admin_churn_events", "org_admin_notes", "ledger_integrity_findings",
] as const;

/** Org data in tables with no org_id of their own — they belong to an org
 *  only through a parent row. Backed up by joining to that parent. Kept in
 *  sync by the schema test in __tests__/org-backup.test.ts. */
export const ORG_CHILD_TABLES = {
  campaign_recipients: { parent: "campaigns", fk: "campaign_id" },
} as const;

/**
 * Tables a restore leaves exactly as they are now rather than rolling back:
 * platform billing/admin state (a restore must not undo a payment, a lock
 * or an admin note), payment-gateway and SMS credentials (keys rotated after
 * the backup must not come back), and short-lived portal sessions/codes.
 */
export const RESTORE_KEEP_CURRENT = new Set<string>([
  "subscriptions", "billing_payments", "admin_churn_events", "org_admin_notes",
  "ledger_integrity_findings", "feature_flags", "payment_gateways", "sms_settings",
  "portal_sessions", "portal_otps",
]);

export type OrgBackup = {
  orgId: number;
  generatedAt: string;
  org: Record<string, unknown> | null;
  tables: Record<string, Record<string, unknown>[]>;
  rowCounts: Record<string, number>;
};

/** Pulls every row belonging to one org, across every org-scoped table, into
 *  a single JSON-serializable snapshot. Table names come only from the fixed
 *  whitelist above (never user input), so building the query with sql.raw
 *  for the identifier is safe. */
export async function buildOrgBackup(orgId: number): Promise<OrgBackup> {
  const [orgRow] = await db.select().from(org).where(eq(org.id, orgId)).limit(1);

  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};

  for (const table of ORG_SCOPED_TABLES) {
    const result = await db.execute(sql`select * from ${sql.raw(table)} where org_id = ${orgId}`);
    const rows = result as unknown as Record<string, unknown>[];
    tables[table] = rows;
    rowCounts[table] = rows.length;
  }
  for (const [table, { parent, fk }] of Object.entries(ORG_CHILD_TABLES)) {
    const result = await db.execute(
      sql`select c.* from ${sql.raw(table)} c join ${sql.raw(parent)} p on p.id = c.${sql.raw(fk)} where p.org_id = ${orgId}`
    );
    const rows = result as unknown as Record<string, unknown>[];
    tables[table] = rows;
    rowCounts[table] = rows.length;
  }

  return {
    orgId,
    generatedAt: new Date().toISOString(),
    org: orgRow ?? null,
    tables,
    rowCounts,
  };
}

function backupPath(orgId: number, timestamp: string): string {
  return `${orgId}/${timestamp}.json`;
}

/** Ensures the private storage bucket exists — createBucket is idempotent
 *  enough for our purposes (errors on "already exists" are swallowed). */
async function ensureBucket() {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

/** Builds and uploads one org's backup, then prunes old snapshots beyond the
 *  retention count — keeps storage cost bounded instead of growing forever. */
export async function runOrgBackup(orgId: number, retainCount = 30): Promise<{ path: string; bytes: number; rowTotal: number }> {
  await ensureBucket();
  const backup = await buildOrgBackup(orgId);
  const timestamp = backup.generatedAt.replace(/[:.]/g, "-");
  const path = backupPath(orgId, timestamp);
  const json = JSON.stringify(backup);

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, json, {
    contentType: "application/json",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data: existing, error: listError } = await supabase.storage.from(BUCKET).list(String(orgId), { limit: 1000, sortBy: { column: "name", order: "desc" } });
  if (!listError && existing && existing.length > retainCount) {
    const toDelete = existing.slice(retainCount).map((f) => `${orgId}/${f.name}`);
    if (toDelete.length > 0) await supabase.storage.from(BUCKET).remove(toDelete);
  }

  const rowTotal = Object.values(backup.rowCounts).reduce((s, n) => s + n, 0);
  return { path, bytes: json.length, rowTotal };
}

/** Runs the backup for every org — the cron entry point. */
export async function runAllOrgBackups(): Promise<{ orgsBackedUp: number; failures: { orgId: number; error: string }[] }> {
  const orgs = await db.select({ id: org.id }).from(org);
  let orgsBackedUp = 0;
  const failures: { orgId: number; error: string }[] = [];

  for (const o of orgs) {
    try {
      await runOrgBackup(o.id);
      orgsBackedUp++;
    } catch (e: any) {
      failures.push({ orgId: o.id, error: e?.message || String(e) });
    }
  }

  return { orgsBackedUp, failures };
}

/** Lists an org's available snapshots, newest first — for the admin download screen. */
export async function listOrgBackups(orgId: number) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).list(String(orgId), { limit: 1000, sortBy: { column: "name", order: "desc" } });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    name: f.name,
    path: `${orgId}/${f.name}`,
    sizeBytes: (f.metadata as { size?: number } | null)?.size ?? 0,
    createdAt: f.created_at,
  }));
}

/** Signed, time-limited download URL for one snapshot — the bucket is
 *  private, so this is the only way to actually fetch a backup file. */
export async function getBackupDownloadUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw error || new Error("Could not create download link");
  return data.signedUrl;
}

/** Loads one stored snapshot (for preview/restore). Paths are always
 *  "<orgId>/<file>.json" inside the private bucket. */
export async function loadOrgBackup(path: string): Promise<OrgBackup> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error || new Error("Backup file not found");
  return JSON.parse(await data.text()) as OrgBackup;
}
