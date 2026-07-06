import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { db, deals, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { fmtKESCompact, parseKES } from "@/lib/money";
import { saveDeal, moveDealStage } from "@/lib/actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Quote sent" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won 🎉" },
  { key: "lost", label: "Lost" },
] as const;

export default async function PipelinePage() {
  await requirePerm("pipeline");
  const o = await getOrg();
  const rows = await db
    .select({ deal: deals, contactName: contacts.displayName })
    .from(deals).where(eq(deals.orgId, o.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id));
  const customers = await db.select().from(contacts).where(eq(contacts.orgId, o.id));

  async function createDeal(formData: FormData) {
    "use server";
    const title = String(formData.get("title") || "").trim();
    const contactId = Number(formData.get("contactId"));
    if (!title || !contactId) return;
    await saveDeal({
      contactId,
      title,
      amountCents: parseKES(String(formData.get("amount") || "0")) || 0,
      stage: "lead",
    });
    redirect("/pipeline");
  }

  async function move(formData: FormData) {
    "use server";
    await moveDealStage(Number(formData.get("dealId")), String(formData.get("stage")));
    redirect("/pipeline");
  }

  return (
    <>
      <PageHeader title="Deals" subtitle="Track opportunities from lead to invoice" />

      <form action={createDeal} className="card p-3 mb-5 flex gap-2 items-center">
        <input
          name="title"
          placeholder="New deal — e.g. Website redesign for Acme"
          className="flex-1 rounded-md border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
        />
        <select name="contactId" className="rounded-md border border-[var(--color-ink-200)] px-2 py-2 text-[13px] bg-white">
          <option value="">Customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.displayName}</option>
          ))}
        </select>
        <input
          name="amount"
          placeholder="Value (KSh)"
          className="w-32 rounded-md border border-[var(--color-ink-200)] px-3 py-2 text-[13px] outline-none"
        />
        <button className="rounded-md bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2">
          Add deal
        </button>
      </form>

      <div className="grid grid-cols-6 gap-3 items-start">
        {STAGES.map((stage) => {
          const stageDeals = rows.filter((r) => r.deal.stage === stage.key);
          const total = stageDeals.reduce((s, r) => s + r.deal.amountCents, 0);
          return (
            <div key={stage.key} className="min-h-[120px]">
              <div className="flex items-baseline justify-between px-1 pb-2">
                <span className="text-[12px] font-semibold text-[var(--color-ink-600)]">{stage.label}</span>
                <span className="text-[11px] text-[var(--color-ink-400)] tnum">
                  {total > 0 ? fmtKESCompact(total) : stageDeals.length || ""}
                </span>
              </div>
              <div className="space-y-2">
                {stageDeals.map(({ deal: d, contactName }) => (
                  <div key={d.id} className="card px-3 py-2.5">
                    <div className="text-[12.5px] font-medium leading-tight">{d.title}</div>
                    <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{contactName}</div>
                    <div className="text-[12px] font-semibold tnum mt-1">{fmtKESCompact(d.amountCents)}</div>
                    <form action={move} className="mt-2 flex gap-1">
                      <input type="hidden" name="dealId" value={d.id} />
                      <select
                        name="stage"
                        defaultValue={d.stage}
                        className="flex-1 rounded border border-[var(--color-ink-100)] text-[11px] px-1 py-0.5 bg-white"
                      >
                        {STAGES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                      <button className="text-[11px] text-[var(--color-accent-600)] font-medium">Move</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[12px] text-[var(--color-ink-400)] mt-6">
        Tip: when a deal is won, create the invoice from the customer&apos;s accepted quote — it converts in one click.
      </p>
    </>
  );
}
