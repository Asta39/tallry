import { db, org, members, subscriptions, paymentEvents } from "@/db";
import { sql, eq, sum, count } from "drizzle-orm";
import { fmtKES } from "@/lib/money";

export default async function AdminDashboard() {
  const [orgCount] = await db.select({ count: count() }).from(org);
  const [userCount] = await db.select({ count: count() }).from(members);
  
  const subs = await db
    .select({
      plan: subscriptions.plan,
      count: count(),
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"))
    .groupBy(subscriptions.plan);

  const [mpesaStats] = await db
    .select({
      totalVolume: sum(paymentEvents.amountCents),
      count: count(),
    })
    .from(paymentEvents)
    .where(eq(paymentEvents.gatewayId, "mpesa_daraja"));

  const [mpesaFailed] = await db
    .select({ count: count() })
    .from(paymentEvents)
    .where(sql`${paymentEvents.gatewayId} = 'mpesa_daraja' AND ${paymentEvents.status} IN ('failed', 'unmatched', 'amount_mismatch')`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Key metrics across all tenants.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-sm font-medium text-[var(--color-ink-500)] mb-1">Total Organizations</div>
          <div className="text-3xl font-bold">{orgCount.count}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-sm font-medium text-[var(--color-ink-500)] mb-1">Total Users</div>
          <div className="text-3xl font-bold">{userCount.count}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-sm font-medium text-[var(--color-ink-500)] mb-1">Active Subscriptions</div>
          <div className="text-3xl font-bold">
            {subs.reduce((acc, s) => acc + s.count, 0)}
          </div>
          <div className="text-xs text-[var(--color-ink-400)] mt-1">
            {subs.map((s) => `${s.plan}: ${s.count}`).join(" · ")}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold tracking-tight pt-4">M-Pesa Metrics (Daraja)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-sm font-medium text-[var(--color-ink-500)] mb-1">Total Volume Processed</div>
          <div className="text-3xl font-bold">{fmtKES(Number(mpesaStats?.totalVolume || 0))}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-sm font-medium text-[var(--color-ink-500)] mb-1">Total Payment Events</div>
          <div className="text-3xl font-bold">{mpesaStats?.count || 0}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-red-200 bg-red-50 shadow-sm">
          <div className="text-sm font-medium text-red-700 mb-1">Failed / Unmatched Events</div>
          <div className="text-3xl font-bold text-red-800">{mpesaFailed.count}</div>
        </div>
      </div>
    </div>
  );
}
