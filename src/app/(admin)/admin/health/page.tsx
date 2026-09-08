import { db, paymentEvents, recurringTemplates, smsLog, org } from "@/db";
import { sql, eq, and, desc, lt, inArray } from "drizzle-orm";
import Link from "next/link";
import { fmtKES } from "@/lib/money";
import { ChurnTrendChart } from "@/components/AdminCharts";

export const dynamic = "force-dynamic";

// Monday-anchored, to match Postgres's date_trunc('week', ...) (ISO weeks).
function weekKeys(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7 - mondayOffset);
    out.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-KE", { month: "short", day: "numeric" }) });
  }
  return out;
}

export default async function AdminHealthPage() {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weeks = weekKeys(12);

  const [failedEvents, overdueRecurring, failedSms, stuckOnboarding, churnRows] = await Promise.all([
    db.select({
      id: paymentEvents.id,
      orgName: org.name,
      orgId: paymentEvents.orgId,
      payerName: paymentEvents.payerName,
      amountCents: paymentEvents.amountCents,
      status: paymentEvents.status,
      createdAt: paymentEvents.createdAt,
    }).from(paymentEvents).leftJoin(org, eq(paymentEvents.orgId, org.id))
      .where(inArray(paymentEvents.status, ["failed", "unmatched", "amount_mismatch"]))
      .orderBy(desc(paymentEvents.createdAt)).limit(10),
    db.select({
      id: recurringTemplates.id,
      orgId: recurringTemplates.orgId,
      orgName: org.name,
      name: recurringTemplates.name,
      docType: recurringTemplates.docType,
      nextRunDate: recurringTemplates.nextRunDate,
      lastRunAt: recurringTemplates.lastRunAt,
    }).from(recurringTemplates).leftJoin(org, eq(recurringTemplates.orgId, org.id))
      .where(and(eq(recurringTemplates.active, true), lt(recurringTemplates.nextRunDate, today)))
      .orderBy(recurringTemplates.nextRunDate).limit(10),
    db.select({
      id: smsLog.id,
      orgId: smsLog.orgId,
      orgName: org.name,
      phone: smsLog.phone,
      error: smsLog.error,
      createdAt: smsLog.createdAt,
    }).from(smsLog).leftJoin(org, eq(smsLog.orgId, org.id))
      .where(eq(smsLog.status, "failed"))
      .orderBy(desc(smsLog.createdAt)).limit(10),
    db.execute(sql`
      select o.id, u.email, substr(u.created_at::text, 1, 10) as joined
      from org o join auth.users u on u.id::text = o.user_id
      where o.name = '' and u.created_at < ${sevenDaysAgo}::timestamptz
      order by u.created_at desc limit 10
    `),
    db.execute(sql`
      select to_char(date_trunc('week', occurred_at::timestamptz), 'YYYY-MM-DD') as week, kind, count(*)::int as n
      from admin_churn_events
      where occurred_at::timestamptz >= now() - interval '12 weeks'
      group by 1, 2
    `),
  ]);

  const stuck = stuckOnboarding as unknown as { id: number; email: string; joined: string }[];
  const churnRaw = churnRows as unknown as { week: string; kind: string; n: number }[];
  const churnByWeek = new Map<string, { suspended: number; trialLapsed: number }>();
  for (const r of churnRaw) {
    const cur = churnByWeek.get(r.week) || { suspended: 0, trialLapsed: 0 };
    if (r.kind === "suspended") cur.suspended = r.n;
    else if (r.kind === "trial_lapsed") cur.trialLapsed = r.n;
    churnByWeek.set(r.week, cur);
  }
  const churnSeries = weeks.map((w) => ({
    label: w.label,
    suspended: churnByWeek.get(w.key)?.suspended || 0,
    trialLapsed: churnByWeek.get(w.key)?.trialLapsed || 0,
  }));
  const issueCount = failedEvents.length + overdueRecurring.length + failedSms.length + stuck.length;

  const Section = ({ title, count, tone, children }: { title: string; count: number; tone: "bad" | "warn"; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold tnum ${
          count === 0 ? "bg-emerald-50 text-emerald-700"
            : tone === "bad" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
        }`}>{count}</span>
      </div>
      {children}
    </div>
  );

  const Empty = ({ msg }: { msg: string }) => (
    <p className="px-5 pb-4 text-[12.5px] text-[var(--color-good)]">✓ {msg}</p>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Health</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">Everything that needs a human, in one place.</p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-medium mb-1 ${
          issueCount === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}>
          <span className={`h-2 w-2 rounded-full ${issueCount === 0 ? "bg-emerald-500" : "bg-amber-500"}`} />
          {issueCount === 0 ? "All clear" : `${issueCount} item${issueCount === 1 ? "" : "s"} need attention`}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-[13.5px] font-semibold">Churn trend</h2>
          <span className="text-[11.5px] text-[var(--color-ink-400)]">last 12 weeks · suspended + trial lapsed</span>
        </div>
        <ChurnTrendChart data={churnSeries} />
      </div>

      <Section title="Failed / Unmatched M-Pesa Events" count={failedEvents.length} tone="bad">
        {failedEvents.length === 0 ? <Empty msg="No failed payment events." /> : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {failedEvents.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{e.payerName || "Unknown payer"}</div>
                    <Link href={`/admin/orgs/${e.orgId}`} className="text-[11px] text-red-700 hover:underline">{e.orgName || `Org #${e.orgId}`}</Link>
                  </td>
                  <td className="px-3 py-2.5 capitalize text-[var(--color-bad)]">{e.status.replace("_", " ")}</td>
                  <td className="px-3 py-2.5 text-right font-medium tnum">{fmtKES(e.amountCents)}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum whitespace-nowrap">{e.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Overdue Recurring Documents" count={overdueRecurring.length} tone="warn">
        {overdueRecurring.length === 0 ? <Empty msg="No recurring templates behind schedule." /> : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {overdueRecurring.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <Link href={`/admin/orgs/${r.orgId}`} className="text-[11px] text-red-700 hover:underline">{r.orgName || `Org #${r.orgId}`}</Link>
                  </td>
                  <td className="px-3 py-2.5 capitalize">{r.docType}</td>
                  <td className="px-3 py-2.5 text-[var(--color-warn)]">due {r.nextRunDate}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] whitespace-nowrap">last ran {r.lastRunAt?.slice(0, 10) || "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Failed SMS" count={failedSms.length} tone="warn">
        {failedSms.length === 0 ? <Empty msg="No failed SMS deliveries." /> : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {failedSms.map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium tnum">{m.phone}</div>
                    <Link href={`/admin/orgs/${m.orgId}`} className="text-[11px] text-red-700 hover:underline">{m.orgName || `Org #${m.orgId}`}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-ink-500)] max-w-[280px] truncate" title={m.error || undefined}>{m.error || "unknown error"}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum whitespace-nowrap">{m.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Stuck in Onboarding (7+ days)" count={stuck.length} tone="warn">
        {stuck.length === 0 ? <Empty msg="Nobody stuck at onboarding." /> : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {stuck.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/orgs/${o.id}`} className="font-medium text-red-700 hover:underline">{o.email}</Link>
                  </td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum whitespace-nowrap">signed up {o.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
