import { db } from "@/db";
import { sql } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminFunnelPage() {
  const [stageRows, stuckRows] = await Promise.all([
    db.execute(sql`
      select
        count(*)::int as signups,
        count(*) filter (where o.name <> '')::int as onboarded,
        count(*) filter (where exists (select 1 from documents d where d.org_id = o.id and d.type = 'invoice'))::int as first_invoice,
        count(*) filter (where exists (select 1 from payments p where p.org_id = o.id))::int as first_payment,
        count(*) filter (where exists (select 1 from subscriptions s where s.org_id = o.id and s.plan in ('standard','business') and s.status = 'active'))::int as paid
      from org o
    `),
    db.execute(sql`
      select o.id, o.name, u.email, substr(u.created_at::text, 1, 10) as joined,
        case
          when o.name = '' then 'signed_up'
          when not exists (select 1 from documents d where d.org_id = o.id and d.type = 'invoice') then 'onboarded'
          when not exists (select 1 from payments p where p.org_id = o.id) then 'invoiced'
          else 'collecting'
        end as stage
      from org o
      left join auth.users u on u.id::text = o.user_id
      where not exists (select 1 from subscriptions s where s.org_id = o.id and s.plan in ('standard','business') and s.status = 'active')
      order by u.created_at desc
      limit 15
    `),
  ]);

  const s = (stageRows as unknown as { signups: number; onboarded: number; first_invoice: number; first_payment: number; paid: number }[])[0];
  const stuck = stuckRows as unknown as { id: number; name: string; email: string | null; joined: string; stage: string }[];

  const stages = [
    { key: "signups", label: "Signed up", desc: "Created an account", value: s.signups },
    { key: "onboarded", label: "Onboarded", desc: "Completed business setup", value: s.onboarded },
    { key: "first_invoice", label: "First invoice", desc: "Created at least one invoice", value: s.first_invoice },
    { key: "first_payment", label: "First payment", desc: "Recorded money in", value: s.first_payment },
    { key: "paid", label: "Paid plan", desc: "On Standard or Business", value: s.paid },
  ];
  const max = Math.max(1, s.signups);

  const stageLabel: Record<string, { label: string; cls: string }> = {
    signed_up: { label: "Never onboarded", cls: "bg-red-50 text-red-700 border-red-200" },
    onboarded: { label: "No invoices yet", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    invoiced: { label: "No payments yet", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    collecting: { label: "Active, on free", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activation Funnel</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Where organizations get to — and where they stall — on the way to paying.</p>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
        <div className="space-y-4">
          {stages.map((st, i) => {
            const prev = i === 0 ? st.value : stages[i - 1].value;
            const conv = i === 0 ? null : prev > 0 ? Math.round((st.value / prev) * 100) : 0;
            return (
              <div key={st.key}>
                {conv !== null && (
                  <div className="flex items-center gap-2 pl-[188px] pb-1 text-[11px] text-[var(--color-ink-400)]">
                    <span>↓</span>
                    <span className={conv < 50 ? "text-[var(--color-bad)] font-medium" : ""}>{conv}% continue</span>
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="w-[172px] shrink-0 text-right">
                    <div className="text-[13px] font-medium">{st.label}</div>
                    <div className="text-[11px] text-[var(--color-ink-400)]">{st.desc}</div>
                  </div>
                  <div className="flex-1 h-9 bg-[var(--color-ink-50)] rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 min-w-fit"
                      style={{
                        width: `${Math.max(6, Math.round((st.value / max) * 100))}%`,
                        background: `color-mix(in srgb, #0f766e ${100 - i * 16}%, #99f6e4)`,
                      }}
                    >
                      <span className="text-[13px] font-semibold text-white tnum">{st.value}</span>
                    </div>
                  </div>
                  <div className="w-14 text-right text-[12px] text-[var(--color-ink-400)] tnum shrink-0">
                    {s.signups ? Math.round((st.value / s.signups) * 100) : 0}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stalled orgs */}
      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[13.5px] font-semibold">Not Paying Yet — Newest First</h2>
          <p className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">Each org&apos;s current stall point. Reach out to the red and amber ones.</p>
        </div>
        <table className="w-full text-left text-[12.5px]">
          <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
            {stuck.map((o) => {
              const meta = stageLabel[o.stage] || stageLabel.signed_up;
              return (
                <tr key={o.id}>
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/orgs/${o.id}`} className="font-medium text-red-700 hover:underline">
                      {o.name || <span className="italic">Unnamed</span>}
                    </Link>
                    <div className="text-[11px] text-[var(--color-ink-400)] truncate max-w-[220px]">{o.email || "—"}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${meta.cls}`}>{meta.label}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum whitespace-nowrap">joined {o.joined}</td>
                </tr>
              );
            })}
            {stuck.length === 0 && (
              <tr><td className="px-5 py-8 text-center text-[var(--color-ink-400)]">Everyone&apos;s paying. 🎉</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
