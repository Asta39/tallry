import { db, ledgerIntegrityFindings, org, cronRuns } from "@/db";
import { and, isNull, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { RunNowButton } from "./RunNowButton";

export const dynamic = "force-dynamic";

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default async function LedgerIntegrityPage() {
  const findings = await db
    .select()
    .from(ledgerIntegrityFindings)
    .where(isNull(ledgerIntegrityFindings.resolvedAt))
    .orderBy(desc(ledgerIntegrityFindings.severity), desc(ledgerIntegrityFindings.lastSeenAt));

  const orgIds = [...new Set(findings.map((f) => f.orgId))];
  const orgs = orgIds.length > 0
    ? await db.select({ id: org.id, name: org.name }).from(org).where(inArray(org.id, orgIds))
    : [];
  const orgName = (id: number) => orgs.find((o) => o.id === id)?.name || `Org #${id}`;

  const [lastRun] = await db.select().from(cronRuns).where(eq(cronRuns.job, "ledger-integrity")).orderBy(desc(cronRuns.createdAt)).limit(1);
  const stale = lastRun ? hoursAgo(lastRun.createdAt) > 26 : true;
  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ledger Integrity</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Trial balance, unbalanced entries, AR/AP/Reimbursements vs source documents, orphaned reversals — checked across every org.
          </p>
        </div>
        <RunNowButton />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Last run</div>
          <div className="mt-1 text-[13px] font-medium">
            {lastRun ? (
              <span className={lastRun.status === "error" ? "text-[var(--color-bad)]" : stale ? "text-amber-700" : ""}>
                {lastRun.createdAt.slice(0, 16).replace("T", " ")} {stale ? "(stale)" : ""}
              </span>
            ) : (
              <span className="text-[var(--color-ink-400)]">Never run</span>
            )}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Open errors</div>
          <div className={`mt-1 text-[18px] font-semibold tnum ${errorCount > 0 ? "text-[var(--color-bad)]" : ""}`}>{errorCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">Open warnings</div>
          <div className={`mt-1 text-[18px] font-semibold tnum ${warningCount > 0 ? "text-amber-700" : ""}`}>{warningCount}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-[var(--color-ink-100)] text-[11px] uppercase tracking-wide text-[var(--color-ink-400)]">
            <tr>
              <th className="px-5 py-2.5">Org</th>
              <th className="px-3 py-2.5">Check</th>
              <th className="px-3 py-2.5">Message</th>
              <th className="px-3 py-2.5">Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-ink-100)]">
            {findings.map((f) => (
              <tr key={f.id}>
                <td className="px-5 py-2.5 font-medium whitespace-nowrap">
                  <Link href={`/admin/orgs/${f.orgId}`} className="hover:underline">{orgName(f.orgId)}</Link>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                    f.severity === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>{f.checkKey}</span>
                </td>
                <td className="px-3 py-2.5 text-[var(--color-ink-700)]">
                  {f.message}
                  {f.detail && <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{f.detail}</div>}
                </td>
                <td className="px-3 py-2.5 text-[var(--color-ink-400)] tnum whitespace-nowrap">{f.lastSeenAt.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
            {findings.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No open findings — every org's books check out.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
