import { getAccess } from "@/lib/access";
import { getOrg, withOrg } from "@/lib/org";
import { myRecentShifts, teamHoursSummary } from "@/lib/time-tracking";
import { PageHeader, Th, Td } from "@/components/ui";
import { todayISO } from "@/lib/money";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}

export default async function TimeTrackingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const o = await getOrg();
  if (!o.timeTrackingEnabled) redirect("/");

  const access = await getAccess();
  const canSeeTeam = !!access?.perms.has("payroll");
  const sp = await searchParams;
  const today = todayISO();
  const from = sp.from || today.slice(0, 8) + "01";
  const to = sp.to || today;

  const [mine, team] = await Promise.all([
    withOrg(() => myRecentShifts(30)),
    canSeeTeam ? withOrg(() => teamHoursSummary(from, to)) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Time Tracking" subtitle="Clock in/out history." />

      <div className="space-y-6">
        {canSeeTeam && team && (
          <div className="card overflow-hidden">
            <div className="px-5 pt-4 pb-3 hairline-b flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold">Team hours</h2>
              <form className="flex items-center gap-2 text-[12.5px]">
                <input type="date" name="from" defaultValue={from} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1" />
                <span className="text-[var(--color-ink-400)]">to</span>
                <input type="date" name="to" defaultValue={to} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1" />
                <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-2.5 py-1">Run</button>
              </form>
            </div>
            <table className="w-full text-left text-[13px]">
              <thead className="hairline-b">
                <tr><Th>Person</Th><Th right>Shifts</Th><Th right>Total hours</Th><Th right>Currently clocked in</Th></tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-ink-100)]">
                {team.summary.map((s, i) => (
                  <tr key={i}>
                    <Td>{s.personName}</Td>
                    <Td right>{s.shifts}</Td>
                    <Td right className="font-medium tnum">{fmtDuration(s.totalSeconds)}</Td>
                    <Td right>{s.openShifts > 0 ? <span className="text-[var(--color-good)] font-medium">Yes</span> : "—"}</Td>
                  </tr>
                ))}
                {team.summary.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No shifts in this period.</td></tr>
                )}
              </tbody>
            </table>
            <p className="px-5 py-3 text-[11.5px] text-[var(--color-ink-400)] hairline-t">
              Use these totals as a reference when running payroll — hourly adjustments aren&apos;t applied automatically.
            </p>
          </div>
        )}

        <div className="card overflow-hidden">
          <div className="px-5 pt-4 pb-3 hairline-b">
            <h2 className="text-[14px] font-semibold">My shifts</h2>
          </div>
          <table className="w-full text-left text-[13px]">
            <thead className="hairline-b">
              <tr><Th>Date</Th><Th>Clock in</Th><Th>Clock out</Th><Th right>Duration</Th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {mine.map((s) => (
                <tr key={s.id}>
                  <Td className="whitespace-nowrap">{s.clockInAt.slice(0, 10)}</Td>
                  <Td>{fmtTime(s.clockInAt)}</Td>
                  <Td>{s.clockOutAt ? fmtTime(s.clockOutAt) : <span className="text-[var(--color-good)] font-medium">Active</span>}</Td>
                  <Td right className="font-medium tnum">{fmtDuration(s.durationSeconds)}</Td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No shifts yet — clock in from the home dashboard.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
