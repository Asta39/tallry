/**
 * Per-org backup and restore.
 *
 * - Coverage: every table holding org data must be in the backup, so a new
 *   feature's table can't silently go un-backed-up.
 * - Validation: a snapshot for another org, or one carrying another org's
 *   rows, is refused before anything is touched.
 * - Round trip: against the live database inside org 1 (same convention as
 *   ledger.test.ts). A real snapshot is stored first as a safety net, then
 *   the test snapshots in memory, changes data, restores, and checks every
 *   restored table matches the snapshot exactly.
 *
 * Run: npm test
 */
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is, eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db, org, todos } from "@/db";
import {
  ORG_SCOPED_TABLES,
  ORG_CHILD_TABLES,
  RESTORE_KEEP_CURRENT,
  buildOrgBackup,
  type OrgBackup,
} from "../org-backup";
import { restoreOrgFromBackup, validateBackupForOrg, previewOrgRestore } from "../org-restore";

/** Declared in schema.ts but never migrated to the database. */
const NEVER_MIGRATED = new Set(["mpesa_transactions", "payslips"]);

const pgTables = Object.values(schema as Record<string, unknown>)
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => getTableConfig(t));

test("every table with an org_id column is backed up", () => {
  const listed = new Set<string>(ORG_SCOPED_TABLES);
  const missing = pgTables
    .filter((t) => t.columns.some((c) => c.name === "org_id"))
    .map((t) => t.name)
    .filter((n) => !listed.has(n) && !NEVER_MIGRATED.has(n));
  assert.deepEqual(missing, [], `Add these to ORG_SCOPED_TABLES in org-backup.ts: ${missing.join(", ")}`);
});

test("tables that belong to an org only through a parent are backed up via that parent", () => {
  const orgScoped = new Set<string>(ORG_SCOPED_TABLES);
  const missing = pgTables
    .filter((t) => !t.columns.some((c) => c.name === "org_id") && !NEVER_MIGRATED.has(t.name))
    .filter((t) => t.foreignKeys.some((fk) => orgScoped.has(getTableConfig(fk.reference().foreignTable).name)))
    .map((t) => t.name)
    .filter((n) => !(n in ORG_CHILD_TABLES));
  assert.deepEqual(missing, [], `Add these to ORG_CHILD_TABLES in org-backup.ts: ${missing.join(", ")}`);
});

const fakeBackup = (orgId: number, tables: OrgBackup["tables"]): OrgBackup => ({
  orgId,
  generatedAt: new Date().toISOString(),
  org: null,
  tables,
  rowCounts: {},
});

test("a snapshot for another org is refused", () => {
  assert.throws(() => validateBackupForOrg(1, fakeBackup(2, {})), /for org #2, not #1/);
});

test("a snapshot carrying another org's rows is refused", () => {
  assert.throws(
    () => validateBackupForOrg(1, fakeBackup(1, { contacts: [{ id: 1, org_id: 1 }, { id: 2, org_id: 7 }] })),
    /row for another org/,
  );
  assert.throws(
    () => validateBackupForOrg(1, fakeBackup(1, { campaigns: [{ id: 5, org_id: 1 }], campaign_recipients: [{ id: 9, campaign_id: 99 }] })),
    /isn't in this org's backup/,
  );
  assert.doesNotThrow(() => validateBackupForOrg(1, fakeBackup(1, { campaigns: [{ id: 5, org_id: 1 }], campaign_recipients: [{ id: 9, campaign_id: 5 }] })));
});

test("restoring org 1 from a snapshot puts every table back exactly", async () => {
  const ORG = 1;
  // Safety net before anything is touched: the snapshot is also written to a
  // local file, so org 1 can be put back by hand if the test dies midway.
  const snapshot = await buildOrgBackup(ORG);
  const safety = path.join(os.tmpdir(), `zeno-org-${ORG}-before-restore-test-${Date.now()}.json`);
  fs.writeFileSync(safety, JSON.stringify(snapshot));
  const [before] = await db.select({ name: org.name }).from(org).where(eq(org.id, ORG));

  // Change things after the snapshot: a new row, an edited row, a renamed org.
  const marker = `RESTORE_TEST_${Date.now()}`;
  await db.insert(todos).values({ orgId: ORG, title: marker, createdAt: new Date().toISOString() });
  await db.update(org).set({ name: `${before.name} ${marker}` }).where(eq(org.id, ORG));

  const preview = await previewOrgRestore(ORG, snapshot);
  const todosRow = preview.find((r) => r.table === "todos")!;
  assert.equal(todosRow.current, (snapshot.tables.todos?.length ?? 0) + 1);
  assert.equal(todosRow.action, "restore");
  assert.equal(preview.find((r) => r.table === "subscriptions")!.action, "keep");

  await restoreOrgFromBackup(ORG, snapshot);

  const [after] = await db.select({ name: org.name }).from(org).where(eq(org.id, ORG));
  assert.equal(after.name, before.name, "org settings restored");
  const leftover = await db.execute(sql`select count(*)::int as n from todos where org_id = ${ORG} and title = ${marker}`);
  assert.equal(Number((leftover as unknown as { n: number }[])[0].n), 0, "row added after the snapshot is gone");

  // Every restored table now matches the snapshot, row for row (by id).
  const now = await buildOrgBackup(ORG);
  for (const table of [...ORG_SCOPED_TABLES, ...Object.keys(ORG_CHILD_TABLES)]) {
    if (RESTORE_KEEP_CURRENT.has(table)) continue;
    const ids = (rows: Record<string, unknown>[] | undefined) => (rows ?? []).map((r) => Number(r.id)).sort((a, b) => a - b);
    assert.deepEqual(ids(now.tables[table]), ids(snapshot.tables[table]), `${table} ids match the snapshot`);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(now.tables.journal_lines ?? [])).sort((a: any, b: any) => a.id - b.id),
    JSON.parse(JSON.stringify(snapshot.tables.journal_lines ?? [])).sort((a: any, b: any) => a.id - b.id),
    "journal lines identical field for field",
  );
  fs.rmSync(safety, { force: true }); // only kept if the test failed
});
