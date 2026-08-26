import { db, org, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { fmtKES } from "@/lib/money";
import { resolveBillingAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage() {
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const subs = await db
    .select({
      id: subscriptions.id,
      orgId: subscriptions.orgId,
      orgName: org.name,
      orgEmail: org.email,
      billingStatus: subscriptions.billingStatus,
      trialEndsAt: subscriptions.trialEndsAt,
      monthlyFeeCents: subscriptions.monthlyFeeCents,
      nextMaintenanceDueAt: subscriptions.nextMaintenanceDueAt,
    })
    .from(subscriptions)
    .leftJoin(org, eq(subscriptions.orgId, org.id))
    .orderBy(subscriptions.nextMaintenanceDueAt);

  const resolved = subs.map((s) => ({
    ...s,
    billing: resolveBillingAccess({
      billingStatus: s.billingStatus as "trial" | "active" | "suspended",
      trialEndsAt: s.trialEndsAt,
      activatedAt: null,
      monthlyFeeCents: s.monthlyFeeCents,
      nextMaintenanceDueAt: s.nextMaintenanceDueAt,
    }),
  }));

  const active = resolved.filter((s) => s.billing.status === "active");
  const locked = resolved.filter((s) => s.billing.status === "locked");
  const trialing = resolved.filter((s) => s.billing.status === "trial");
  const dueSoon = active.filter((s) => s.nextMaintenanceDueAt && s.nextMaintenanceDueAt <= in30);

  const mrrCents = active.reduce((sum, s) => sum + s.monthlyFeeCents, 0);
  const arrCents = mrrCents * 12;

  const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
      <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">{label}</div>
      <div className="text-[26px] font-semibold tracking-tight tnum mt-1.5 leading-none">{value}</div>
      {sub && <div className="text-[11.5px] mt-2 text-[var(--color-ink-400)]">{sub}</div>}
    </div>
  );

  const OrgTable = ({ rows, empty, dateKey }: { rows: typeof resolved; empty: string; dateKey: "nextMaintenanceDueAt" | "trialEndsAt" }) => (
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
            <td className="px-3 py-2.5 text-right tnum font-medium">{s.monthlyFeeCents > 0 ? `${fmtKES(s.monthlyFeeCents)}/mo` : "—"}</td>
            <td className="px-5 py-2.5 text-right tnum whitespace-nowrap text-[var(--color-ink-400)]">{s[dateKey] || "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={3} className="px-5 py-8 text-center text-[var(--color-ink-400)]">{empty}</td></tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Maintenance-fee revenue across the platform.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="MRR" value={fmtKES(mrrCents)} sub={`${active.length} active org${active.length === 1 ? "" : "s"}`} />
        <Stat label="ARR (run rate)" value={fmtKES(arrCents)} sub="MRR × 12" />
        <Stat label="On trial" value={String(trialing.length)} sub="not yet a paying customer" />
        <Stat label="Locked" value={String(locked.length)} sub="trial ended, not activated" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[13.5px] font-semibold">Maintenance due within 30 days</h2>
          </div>
          <OrgTable rows={dueSoon} empty="Nothing due in the next 30 days." dateKey="nextMaintenanceDueAt" />
        </div>
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[13.5px] font-semibold">On trial</h2>
          </div>
          <OrgTable rows={trialing} empty="No orgs currently on trial." dateKey="trialEndsAt" />
        </div>
      </div>
    </div>
  );
}
