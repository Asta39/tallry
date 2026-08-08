import { db, org, cronRuns } from "@/db";
import { desc, eq } from "drizzle-orm";
import { listOrgBackups } from "@/lib/org-backup";
import { OrgBackupRow } from "./OrgBackupRow";
import { BackupAllButton } from "./BackupAllButton";

export const dynamic = "force-dynamic";

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default async function BackupsPage() {
  const orgs = await db.select({ id: org.id, name: org.name, email: org.email }).from(org).orderBy(org.id);

  const orgBackups = await Promise.all(
    orgs.map(async (o) => {
      try {
        const backups = await listOrgBackups(o.id);
        return { org: o, backups, error: null as string | null };
      } catch (e: any) {
        return { org: o, backups: [], error: e?.message || "Could not list backups" };
      }
    })
  );

  const [lastRun] = await db.select().from(cronRuns).where(eq(cronRuns.job, "org-backups")).orderBy(desc(cronRuns.createdAt)).limit(1);
  const stale = lastRun ? hoursAgo(lastRun.createdAt) > 26 : true;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Org Backups</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Nightly per-org JSON snapshot of every org-scoped table — private storage, last 30 kept per org.
          </p>
        </div>
        <BackupAllButton />
      </div>

      <div className="bg-white p-4 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Last scheduled run</div>
        <div className="mt-1 text-[13px] font-medium">
          {lastRun ? (
            <span className={lastRun.status === "error" ? "text-[var(--color-bad)]" : stale ? "text-amber-700" : ""}>
              {lastRun.createdAt.slice(0, 16).replace("T", " ")} {stale ? "(stale)" : ""} — {lastRun.detail}
            </span>
          ) : (
            <span className="text-[var(--color-ink-400)]">Never run</span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {orgBackups.map(({ org: o, backups, error }) => (
          <OrgBackupRow key={o.id} orgId={o.id} orgName={o.name || `Org #${o.id}`} orgEmail={o.email} backups={backups} error={error} />
        ))}
      </div>
    </div>
  );
}
