import { db, org, subscriptions } from "@/db";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { fmtKES } from "@/lib/money";
import { PLANS, PlanKey } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const subs = await db
    .select({
      id: subscriptions.id,
      orgId: subscriptions.orgId,
      orgName: org.name,
      orgEmail: org.email,
      plan: subscriptions.plan,
      status: subscriptions.status,
      paidUntil: subscriptions.paidUntil,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .leftJoin(org, eq(subscriptions.orgId, org.id))
    .orderBy(subscriptions.paidUntil);

  const paidPlans: PlanKey[] = ["standard", "business"];
  const isPaid = (p: string) => paidPlans.includes(p as PlanKey);

  const activePaid = subs.filter((s) => isPaid(s.plan) && s.paidUntil >= today);
  const expiredPaid = subs.filter((s) => isPaid(s.plan) && s.paidUntil < today);
  const renewingSoon = activePaid.filter((s) => s.paidUntil <= in30);

  const mrrCents = activePaid.reduce((s, r) => s + PLANS[r.plan as PlanKey].monthlyCents, 0);
  const arrCents = mrrCents * 12;
  const churnRate = activePaid.length + expiredPaid.length > 0
    ? Math.round((expiredPaid.length / (activePaid.length + expiredPaid.length)) * 100)
    : 0;

  const byPlan = paidPlans.map((p) => ({
    plan: p,
    name: PLANS[p].name,
    count: activePaid.filter((s) => s.plan === p).length,
    mrr: activePaid.filter((s) => s.plan === p).length * PLANS[p].monthlyCents,
  }));

  const Stat = ({ label, value, sub, subTone }: { label: string; value: string; sub?: string; subTone?: "good" | "bad" | "muted" }) => (
    <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
      <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">{label}</div>
      <div className="text-[26px] font-semibold tracking-tight tnum mt-1.5 leading-none">{value}</div>
      {sub && (
        <div className={`text-[11.5px] mt-2 ${subTone === "good" ? "text-[var(--color-good)]" : subTone === "bad" ? "text-[var(--color-bad)]" : "text-[var(--color-ink-400)]"}`}>{sub}</div>
      )}
    </div>
  );

  const SubTable = ({ rows, empty, dateTone }: { rows: typeof subs; empty: string; dateTone?: "bad" | "warn" }) => (
    <table className="w-full text-left text-[12.5px]">
      <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
        {rows.map((s) => (
          <tr key={s.id}>
            <td className="px-5 py-2.5">
              <Link href={`/admin/orgs/${s.orgId}`} className="font-medium text-red-700 hover:underline truncate block max-w-[200px]">
                {s.orgName || `Org #${s.orgId}`}
              </Link>
              <div className="text-[11px] text-[var(--color-ink-400)] truncate max-w-[200px]">{s.orgEmail || "—"}</div>
            </td>
            <td className="px-3 py-2.5 capitalize">{s.plan}</td>
            <td className="px-3 py-2.5 text-right tnum font-medium">{fmtKES(PLANS[s.plan as PlanKey].monthlyCents)}/mo</td>
            <td className={`px-5 py-2.5 text-right tnum whitespace-nowrap ${dateTone === "bad" ? "text-[var(--color-bad)]" : dateTone === "warn" ? "text-[var(--color-warn)]" : "text-[var(--color-ink-400)]"}`}>
              {s.paidUntil}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">{empty}</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Subscription revenue across the platform.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="MRR" value={fmtKES(mrrCents)} sub={`${activePaid.length} active paid org${activePaid.length === 1 ? "" : "s"}`} subTone="muted" />
        <Stat label="ARR (run rate)" value={fmtKES(arrCents)} sub="MRR × 12" subTone="muted" />
        <Stat label="Renewing in 30 days" value={String(renewingSoon.length)} sub={renewingSoon.length ? "follow up before expiry" : "nothing due"} subTone={renewingSoon.length ? "muted" : "good"} />
        <Stat label="Churned (expired paid)" value={String(expiredPaid.length)} sub={`${churnRate}% of ever-paid orgs`} subTone={expiredPaid.length ? "bad" : "good"} />
      </div>

      {/* MRR by plan */}
      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
        <h2 className="text-[13.5px] font-semibold mb-4">MRR by Plan</h2>
        <div className="space-y-3">
          {byPlan.map((p) => (
            <div key={p.plan} className="flex items-center gap-4">
              <span className="w-20 text-[12.5px] text-[var(--color-ink-600)]">{p.name}</span>
              <div className="flex-1 h-5 bg-[var(--color-ink-50)] rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: mrrCents ? `${Math.max(2, Math.round((p.mrr / mrrCents) * 100))}%` : "0%",
                    background: p.plan === "business" ? "#0f766e" : "#5eead4",
                  }}
                />
              </div>
              <span className="w-32 text-right text-[12.5px] font-medium tnum">{fmtKES(p.mrr)}</span>
              <span className="w-14 text-right text-[11.5px] text-[var(--color-ink-400)] tnum">{p.count} org{p.count === 1 ? "" : "s"}</span>
            </div>
          ))}
          {mrrCents === 0 && <p className="text-[12.5px] text-[var(--color-ink-400)]">No paid subscriptions yet.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[13.5px] font-semibold">Upcoming Renewals (30 days)</h2>
          </div>
          <SubTable rows={renewingSoon} empty="No renewals due in the next 30 days." dateTone="warn" />
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[13.5px] font-semibold">Expired Paid Plans</h2>
          </div>
          <SubTable rows={expiredPaid} empty="No churned paid orgs. 🎉" dateTone="bad" />
        </div>
      </div>
    </div>
  );
}
