import { db, org, subscriptions, billingPayments, members } from "@/db";
import { sql, eq, count } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { resolveBillingAccess } from "@/lib/billing";
import { SignupsChart, ModulePreferenceBar, RevenueCompositionDonut } from "@/components/AdminCharts";
import { AdminActivityRings } from "@/components/AdminActivityRings";

export const dynamic = "force-dynamic";

function monthKeys(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-KE", { month: "short" }),
    });
  }
  return out;
}

const MODULE_PREF_LABELS: Record<string, string> = {
  crm: "CRM only",
  crm_accounting: "CRM + Accounting",
  crm_payroll: "CRM + Payroll",
  all: "All of it",
  not_stated: "Not stated",
};

export default async function AdminAnalyticsPage() {
  const months = monthKeys(6);

  const [orgs, subs, allMembers, payments, signupRows] = await Promise.all([
    db.select().from(org),
    db.select().from(subscriptions),
    db.select({ orgId: members.orgId, active: members.active }).from(members),
    db.select().from(billingPayments),
    db.execute(sql`
      select substr(u.created_at::text, 1, 7) as month, count(*)::int as signups
      from org o join auth.users u on u.id::text = o.user_id
      group by 1
    `),
  ]);

  const statuses = subs.map((s) => ({ ...resolveBillingAccess(s), orgId: s.orgId }));

  const activeSubs = subs.filter((s) => s.billingStatus === "active");
  const activeOrgIds = new Set(activeSubs.map((s) => s.orgId));
  const activeOrgs = orgs.filter((o) => activeOrgIds.has(o.id));
  const trialCount = statuses.filter((s) => s.status === "trial").length;
  const lockedCount = statuses.filter((s) => s.status === "locked").length;

  const mrrCents = activeSubs.reduce((s, r) => s + r.monthlyFeeCents, 0);

  const activeMemberCount = allMembers.filter((m) => m.active).length;
  const totalSeats = activeMemberCount + activeOrgs.length; // +1 owner per active org

  // Module adoption among active orgs — a genuine 0-100% metric (no
  // fabricated target), unlike an invented revenue goal.
  const crmOn = activeOrgs.filter((o) => o.crmEnabled).length;
  const acctOn = activeOrgs.filter((o) => o.accountingEnabled).length;
  const payrollOn = activeOrgs.filter((o) => o.payrollEnabled).length;
  const denom = activeOrgs.length || 1;

  // Welcome-trial module preference distribution.
  const prefCounts: Record<string, number> = {};
  for (const o of orgs) {
    const key = o.modulePreference || "not_stated";
    prefCounts[key] = (prefCounts[key] || 0) + 1;
  }
  const prefData = Object.entries(prefCounts)
    .map(([key, count]) => ({ label: MODULE_PREF_LABELS[key] || key, count }))
    .sort((a, b) => b.count - a.count);

  // Revenue composition — real applied/COMPLETE billing_payments only.
  const revenueByKind: Record<string, number> = {};
  for (const p of payments) {
    if (p.state !== "applied" && p.state !== "COMPLETE") continue;
    revenueByKind[p.kind] = (revenueByKind[p.kind] || 0) + p.amountCents;
  }
  const revenueData = Object.entries(revenueByKind)
    .filter(([, cents]) => cents > 0)
    .map(([kind, totalCents]) => ({ kind, totalCents }));

  const signupsByMonth = new Map((signupRows as unknown as { month: string; signups: number }[]).map((r) => [r.month, Number(r.signups)]));
  const signupSeries = months.map((m) => ({ label: m.label, signups: signupsByMonth.get(m.key) || 0 }));

  const Card = ({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) => (
    <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
      <div className="mb-4">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {subtitle && <p className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
      <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">{label}</div>
      <div className="text-[22px] font-semibold tnum mt-1">{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--color-ink-400)] mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Platform-wide health, adoption and revenue composition.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="MRR" value={fmtKES(mrrCents)} sub={`${activeOrgs.length} active org${activeOrgs.length === 1 ? "" : "s"}`} />
        <Stat label="Trial orgs" value={String(trialCount)} />
        <Stat label="Locked orgs" value={String(lockedCount)} />
        <Stat label="Total orgs" value={String(orgs.length)} />
        <Stat label="Paid seats" value={String(totalSeats)} sub="owners + active staff" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Module adoption" subtitle="Share of active orgs with each module switched on">
          <AdminActivityRings
            title="Modules enabled"
            rings={[
              { label: "CRM", value: (crmOn / denom) * 100, color: "#0f766e", current: crmOn, target: activeOrgs.length, unit: "orgs" },
              { label: "Accounting", value: (acctOn / denom) * 100, color: "#5eead4", current: acctOn, target: activeOrgs.length, unit: "orgs" },
              { label: "Payroll", value: (payrollOn / denom) * 100, color: "#f59e0b", current: payrollOn, target: activeOrgs.length, unit: "orgs" },
            ]}
          />
        </Card>

        <Card title="Revenue composition" subtitle="Applied/completed platform payments, all-time">
          {revenueData.length > 0 ? (
            <RevenueCompositionDonut data={revenueData} />
          ) : (
            <div className="h-44 flex items-center justify-center text-[13px] text-[var(--color-ink-400)]">No payments recorded yet.</div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Signups" subtitle="New organizations per month">
          <SignupsChart data={signupSeries} />
        </Card>

        <Card title="Welcome-screen module preference" subtitle="What orgs said they wanted, at signup">
          {prefData.length > 0 ? (
            <ModulePreferenceBar data={prefData} />
          ) : (
            <div className="h-48 flex items-center justify-center text-[13px] text-[var(--color-ink-400)]">No data yet.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
