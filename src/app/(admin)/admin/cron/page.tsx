import { db, cronRuns } from "@/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const JOBS = [
  { key: "recurring", label: "Recurring Documents", desc: "Generates due recurring invoices, bills and expenses", cadence: "daily" },
  { key: "due-dates", label: "Due-Date Alerts", desc: "Notifies tenants about invoices due today / tomorrow / in 3 days", cadence: "daily" },
];

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

export default async function AdminCronPage() {
  const lastRuns = await Promise.all(
    JOBS.map((j) => db.select().from(cronRuns).where(eq(cronRuns.job, j.key)).orderBy(desc(cronRuns.createdAt)).limit(1).then((r) => r[0]))
  );
  const history = await db.select().from(cronRuns).orderBy(desc(cronRuns.createdAt)).limit(50);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scheduled Jobs</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Cron execution history. Both jobs should run daily via the Vercel cron schedule.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {JOBS.map((j, i) => {
          const last = lastRuns[i];
          const stale = last ? hoursAgo(last.createdAt) > 26 : true;
          const failed = last?.status === "error";
          return (
            <div key={j.key} className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-[13.5px] font-semibold">{j.label}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  failed ? "bg-red-50 text-red-700" : stale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${failed ? "bg-red-500" : stale ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {failed ? "last run failed" : stale ? "not run in 26h+" : "healthy"}
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--color-ink-400)] mt-1">{j.desc}</p>
              <div className="mt-3 text-[12.5px]">
                {last ? (
                  <>
                    <span className="text-[var(--color-ink-400)]">Last run:</span>{" "}
                    <span className="font-medium tnum">{last.createdAt.slice(0, 16).replace("T", " ")}</span>
                    <span className="text-[var(--color-ink-400)]"> · {last.durationMs}ms · </span>
                    <span className={last.status === "error" ? "text-[var(--color-bad)]" : ""}>{last.detail}</span>
                  </>
                ) : (
                  <span className="text-[var(--color-ink-400)]">Never run — check the Vercel cron config for <code className="text-[11px]">/api/cron/{j.key}</code>.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[13.5px] font-semibold">Run History</h2>
        </div>
        <table className="w-full text-left text-[12.5px]">
          <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
            {history.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-2.5 text-[var(--color-ink-400)] tnum whitespace-nowrap">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-2.5 font-medium">{JOBS.find((j) => j.key === r.job)?.label || r.job}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                    r.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                  }`}>{r.status}</span>
                </td>
                <td className="px-3 py-2.5 text-[var(--color-ink-500)] max-w-[320px] truncate" title={r.detail || undefined}>{r.detail}</td>
                <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum">{r.durationMs}ms</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No runs logged yet — history appears after the next scheduled run.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
