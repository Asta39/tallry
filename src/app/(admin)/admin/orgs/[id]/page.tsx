import { db, org, members, subscriptions, documents, payments, paymentGateways, paymentEvents, billingPayments } from "@/db";
import { eq, and, desc, count, sql, gte, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fmtKES } from "@/lib/money";
import { resolveBillingAccess } from "@/lib/billing";
import { BillingPanel } from "./BillingPanel";
import { ImpersonateButton } from "../ImpersonateButton";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = Number(id);
  if (!Number.isFinite(orgId)) notFound();

  const [o] = await db.select().from(org).where(eq(org.id, orgId)).limit(1);
  if (!o) notFound();

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    ownerRows,
    [sub],
    memberList,
    [docStats],
    [invoicesThisMonth],
    [paymentStats],
    gateways,
    recentEvents,
    [lastDoc],
    billingHistory,
  ] = await Promise.all([
    o.userId
      ? db.execute(sql`select email, substr(created_at::text, 1, 10) as joined, substr(coalesce(last_sign_in_at::text, ''), 1, 10) as last_login from auth.users where id::text = ${o.userId}`)
      : Promise.resolve([] as unknown[]),
    db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).limit(1),
    db.select().from(members).where(eq(members.orgId, orgId)),
    db.select({ count: count() }).from(documents).where(eq(documents.orgId, orgId)),
    db.select({ count: count() }).from(documents).where(and(eq(documents.orgId, orgId), inArray(documents.type, ["invoice", "quote"]), gte(documents.createdAt, monthStart))),
    db.select({ count: count(), total: sql<string>`coalesce(sum(${payments.amountCents}), 0)` }).from(payments).where(eq(payments.orgId, orgId)),
    db.select().from(paymentGateways).where(eq(paymentGateways.orgId, orgId)),
    db.select().from(paymentEvents).where(eq(paymentEvents.orgId, orgId)).orderBy(desc(paymentEvents.createdAt)).limit(5),
    db.select({ createdAt: documents.createdAt }).from(documents).where(eq(documents.orgId, orgId)).orderBy(desc(documents.createdAt)).limit(1),
    db.select().from(billingPayments).where(eq(billingPayments.orgId, orgId)).orderBy(desc(billingPayments.createdAt)),
  ]);

  const owner = (ownerRows as unknown as { email: string; joined: string; last_login: string }[])[0];
  const today = new Date().toISOString().slice(0, 10);
  const billing = sub
    ? resolveBillingAccess(sub)
    : { status: "trial" as const, trialEndsAt: today, trialDaysLeft: 7, monthlyFeeCents: 0, nextMaintenanceDueAt: null };
  const needsActivation = billing.status === "locked" && sub?.billingStatus === "trial";

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between gap-4 py-2 border-t border-[var(--color-ink-100)] first:border-t-0 text-[13px]">
      <span className="text-[var(--color-ink-400)]">{k}</span>
      <span className="font-medium text-right truncate">{v}</span>
    </div>
  );

  const Card = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/orgs" className="text-[12px] text-[var(--color-ink-400)] hover:underline">← Organizations</Link>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{o.name || <span className="italic text-[var(--color-ink-400)]">Not onboarded</span>}</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">Org #{o.id} · {owner?.email || "no owner email"}</p>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11.5px] font-medium border capitalize ${
            billing.status === "locked" ? "bg-red-50 text-red-700 border-red-200"
              : billing.status === "trial" ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {billing.status === "trial" ? `Trial · ${billing.trialDaysLeft}d left` : billing.status === "locked" ? "Locked" : "Active"}
          </span>
          <ImpersonateButton orgId={o.id} />
        </div>
      </div>

      {/* Usage tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Invoices/quotes this month</div>
          <div className="text-[24px] font-semibold tnum mt-1.5 leading-none">{invoicesThisMonth.count}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Staff seats</div>
          <div className="text-[24px] font-semibold tnum mt-1.5 leading-none">{memberList.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Documents (all time)</div>
          <div className="text-[24px] font-semibold tnum mt-1.5 leading-none">{docStats.count}</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-2">last: {lastDoc?.createdAt?.slice(0, 10) || "never"}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">Payments recorded</div>
          <div className="text-[24px] font-semibold tnum mt-1.5 leading-none">{paymentStats.count}</div>
          <div className="text-[11.5px] text-[var(--color-ink-400)] mt-2">{fmtKES(Number(paymentStats.total || 0))} total</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Billing management */}
        <Card title="Billing">
          <BillingPanel
            orgId={o.id}
            status={billing.status}
            trialEndsAt={billing.trialEndsAt}
            needsActivation={needsActivation}
            monthlyFeeCents={billing.monthlyFeeCents}
            nextMaintenanceDueAt={billing.nextMaintenanceDueAt}
            createdAt={sub?.createdAt?.slice(0, 10) || "—"}
            isSuspended={sub?.billingStatus === "suspended"}
            history={billingHistory}
          />
        </Card>

        {/* Org profile */}
        <Card title="Business Profile">
          <Row k="Owner" v={owner?.email || "—"} />
          <Row k="Owner joined" v={owner?.joined || "—"} />
          <Row k="Owner last sign-in" v={owner?.last_login || "—"} />
          <Row k="Business email" v={o.email || "—"} />
          <Row k="Phone" v={o.phone || "—"} />
          <Row k="KRA PIN" v={o.kraPin || "—"} />
          <Row k="VAT registered" v={o.vatRegistered ? "Yes" : "No"} />
          <Row k="Portal slug" v={o.portalSlug || "—"} />
          <Row k="Books locked through" v={o.lockDate || "—"} />
        </Card>

        {/* Staff */}
        <Card title={`Staff (${memberList.length})`}>
          {memberList.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-400)]">No staff members.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {memberList.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[11px] text-[var(--color-ink-400)] truncate">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="capitalize text-[11.5px] text-[var(--color-ink-600)]">{m.role}</span>
                    <span className={`h-2 w-2 rounded-full ${m.active ? "bg-emerald-500" : "bg-[var(--color-ink-200)]"}`} title={m.active ? "Active" : "Inactive"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Gateways + events */}
        <Card title="Payment Gateways">
          {gateways.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-400)]">No gateways configured.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)] mb-4">
              {gateways.map((g) => (
                <li key={g.id} className="py-2 flex items-center justify-between text-[13px]">
                  <span className="font-medium">{g.gatewayId === "mpesa_daraja" ? "M-Pesa Daraja" : g.gatewayId}</span>
                  <span className="flex items-center gap-2 text-[11.5px]">
                    <span className="text-[var(--color-ink-400)]">{g.environment}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full font-medium border ${g.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]"}`}>
                      {g.enabled ? "enabled" : "disabled"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[11.5px] text-[var(--color-ink-400)] mb-1.5">Recent events</div>
          {recentEvents.length === 0 ? (
            <p className="text-[12.5px] text-[var(--color-ink-400)]">None.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-ink-100)]">
              {recentEvents.map((e) => (
                <li key={e.id} className="py-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="truncate">{e.payerName || e.providerRef}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="capitalize text-[11px] text-[var(--color-ink-400)]">{e.status.replace("_", " ")}</span>
                    <span className="font-medium tnum">{fmtKES(e.amountCents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
