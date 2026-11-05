import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ORG_SCOPED_TABLES, ORG_CHILD_TABLES, RESTORE_KEEP_CURRENT, type OrgBackup } from "./org-backup";

/**
 * In-place restore of one org from one of its backup snapshots.
 *
 * Every row goes back with its original id, so every link between records —
 * declared foreign keys and the many id columns only the code knows about —
 * stays exactly as it was. Ids are global serials that are never reused, so
 * this org's ids can't collide with another org's. The whole restore is one
 * transaction: if any statement fails, nothing changes.
 *
 * Tables in RESTORE_KEEP_CURRENT are left as they are now, as are tables the
 * snapshot doesn't contain (taken before that table was backed up) — deleting
 * those would lose data the snapshot never captured.
 */

type Row = Record<string, unknown>;
const CHILD = ORG_CHILD_TABLES as Record<string, { parent: string; fk: string }>;
const ALL_TABLES: string[] = [...ORG_SCOPED_TABLES, ...Object.keys(CHILD)];
const CHUNK = 2000;
/** Owner link and id stay as they are now — the restore is about the org's data, not who owns it. */
const ORG_ROW_KEEP = new Set(["id", "user_id"]);

const ident = (name: string) => sql.raw(`"${name.replace(/"/g, '""')}"`);

export type RestorePreviewRow = {
  table: string;
  current: number;
  backup: number | null;
  action: "restore" | "keep";
  reason?: string;
};

/** Reject a snapshot that isn't this org's, or that carries rows for another org. */
export function validateBackupForOrg(orgId: number, backup: OrgBackup): void {
  if (!backup || typeof backup !== "object" || !backup.tables || typeof backup.tables !== "object") {
    throw new Error("This file isn't a Zeno org backup");
  }
  if (backup.orgId !== orgId) throw new Error(`This backup is for org #${backup.orgId}, not #${orgId}`);
  for (const t of ORG_SCOPED_TABLES) {
    const rows = backup.tables[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`Backup table ${t} is malformed`);
    for (const r of rows) {
      if (r.org_id !== orgId) throw new Error(`Backup table ${t} contains a row for another org — refusing to restore`);
    }
  }
  for (const [t, { parent, fk }] of Object.entries(CHILD)) {
    const rows = backup.tables[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`Backup table ${t} is malformed`);
    const parentIds = new Set((backup.tables[parent] ?? []).map((p) => p.id));
    for (const r of rows) {
      if (!parentIds.has(r[fk])) throw new Error(`Backup table ${t} has a row whose ${parent} isn't in this org's backup — refusing to restore`);
    }
  }
}

/** Tables this snapshot will restore, in an order where every parent comes before its children. */
async function restoreOrder(backup: OrgBackup): Promise<string[]> {
  const tables = ALL_TABLES.filter((t) => !RESTORE_KEEP_CURRENT.has(t) && Array.isArray(backup.tables[t]));
  const fks = (await db.execute(
    sql`select conrelid::regclass::text as child, confrelid::regclass::text as parent from pg_constraint where contype = 'f' and connamespace = 'public'::regnamespace`
  )) as unknown as { child: string; parent: string }[];
  const inSet = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const f of fks) if (inSet.has(f.child) && inSet.has(f.parent) && f.child !== f.parent) deps.get(f.child)!.add(f.parent);

  const out: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (t: string) => {
    if (done.has(t)) return;
    if (visiting.has(t)) throw new Error(`Circular foreign keys around ${t} — can't order the restore`);
    visiting.add(t);
    for (const d of deps.get(t)!) visit(d);
    visiting.delete(t);
    done.add(t);
    out.push(t);
  };
  tables.forEach(visit);
  return out;
}

async function currentCount(orgId: number, table: string): Promise<number> {
  const child = CHILD[table];
  const [r] = (child
    ? await db.execute(sql`select count(*)::int as n from ${ident(table)} c join ${ident(child.parent)} p on p.id = c.${ident(child.fk)} where p.org_id = ${orgId}`)
    : await db.execute(sql`select count(*)::int as n from ${ident(table)} where org_id = ${orgId}`)) as unknown as { n: number }[];
  return Number(r.n);
}

/** Row counts now vs in the snapshot, table by table, and what a restore would do with each. */
export async function previewOrgRestore(orgId: number, backup: OrgBackup): Promise<RestorePreviewRow[]> {
  validateBackupForOrg(orgId, backup);
  const rows: RestorePreviewRow[] = [];
  for (const table of ALL_TABLES) {
    const inBackup = Array.isArray(backup.tables[table]);
    const keep = RESTORE_KEEP_CURRENT.has(table);
    rows.push({
      table,
      current: await currentCount(orgId, table),
      backup: inBackup ? backup.tables[table].length : null,
      action: keep || !inBackup ? "keep" : "restore",
      reason: keep ? "billing, admin, credentials or sessions — always kept as now" : !inBackup ? "not in this backup" : undefined,
    });
  }
  return rows;
}

async function tableColumns(): Promise<Map<string, Set<string>>> {
  const cols = (await db.execute(
    sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`
  )) as unknown as { table_name: string; column_name: string }[];
  const map = new Map<string, Set<string>>();
  for (const c of cols) {
    if (!map.has(c.table_name)) map.set(c.table_name, new Set());
    map.get(c.table_name)!.add(c.column_name);
  }
  return map;
}

/**
 * Replace this org's data with the snapshot's, in one transaction. Returns
 * rows restored per table. Callers must take a fresh backup of the current
 * state first so the restore itself can be undone (see restoreOrgBackupAction).
 */
export async function restoreOrgFromBackup(orgId: number, backup: OrgBackup): Promise<Record<string, number>> {
  validateBackupForOrg(orgId, backup);
  const order = await restoreOrder(backup);
  const columns = await tableColumns();
  const restored: Record<string, number> = {};

  await db.transaction(async (tx) => {
    // Children first, so nothing is left pointing at a deleted parent.
    for (const table of [...order].reverse()) {
      const child = CHILD[table];
      if (child) {
        await tx.execute(sql`delete from ${ident(table)} c using ${ident(child.parent)} p where p.id = c.${ident(child.fk)} and p.org_id = ${orgId}`);
      } else {
        await tx.execute(sql`delete from ${ident(table)} where org_id = ${orgId}`);
      }
    }

    // Parents first. Only columns that exist both in the snapshot and in the
    // table today: columns added since the snapshot take their defaults,
    // columns since removed are dropped.
    for (const table of order) {
      const rows = [...(backup.tables[table] as Row[])].sort((a, b) => Number(a.id) - Number(b.id));
      restored[table] = rows.length;
      if (!rows.length) continue;
      const live = columns.get(table) ?? new Set<string>();
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => live.has(c));
      const colList = sql.join(cols.map(ident), sql`, `);
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = JSON.stringify(rows.slice(i, i + CHUNK));
        await tx.execute(
          sql`insert into ${ident(table)} (${colList}) select ${colList} from json_populate_recordset(null::${ident(table)}, ${chunk}::json)`
        );
      }
    }

    // The org's own settings row (name, PIN, numbering, branding…).
    if (backup.org) {
      const live = columns.get("org") ?? new Set<string>();
      const cols = Object.keys(backup.org).filter((c) => live.has(c) && !ORG_ROW_KEEP.has(c));
      if (cols.length) {
        const colList = sql.join(cols.map(ident), sql`, `);
        await tx.execute(
          sql`update "org" set (${colList}) = (select ${colList} from json_populate_record(null::"org", ${JSON.stringify(backup.org)}::json)) where id = ${orgId}`
        );
      }
    }
  });

  return restored;
}
