import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, contacts, documents, activities, deals } from "@/db";
import { desc } from "drizzle-orm";
import { fmtKES, todayISO } from "@/lib/money";
import { addActivity } from "@/lib/actions";
import { PageHeader, StatusPill, StatCard, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ContactDetail({ params }: { params: Promise<{ id: string }> }) {
  const o = await getOrg();
  const { id } = await params;
  const cid = Number(id);
  const [c] = await db.select().from(contacts).where(and(eq(contacts.orgId, o.id), eq(contacts.id, cid))).limit(1);
  if (!c) notFound();

  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, o.id), eq(documents.contactId, cid)))
    .orderBy(desc(documents.date))
    .limit(15);
  const acts = await db
    .select()
    .from(activities)
    .where(and(eq(activities.orgId, o.id), eq(activities.contactId, cid)))
    .orderBy(desc(activities.createdAt));
  const contactDeals = await db.select().from(deals).where(and(eq(deals.orgId, o.id), eq(deals.contactId, cid)));

  const owedToYou = docs
    .filter((d) => d.type === "invoice" && ["open", "partial"].includes(d.status))
    .reduce((s, d) => s + d.totalCents - d.paidCents, 0);
  const youOwe = docs
    .filter((d) => d.type === "bill" && ["open", "partial"].includes(d.status))
    .reduce((s, d) => s + d.totalCents - d.paidCents, 0);
  const lifetime = docs
    .filter((d) => d.type === "invoice" && !["draft", "void"].includes(d.status))
    .reduce((s, d) => s + d.totalCents, 0);

  async function note(formData: FormData) {
    "use server";
    const content = String(formData.get("content") || "").trim();
    if (content) await addActivity(cid, String(formData.get("kind") || "note"), content);
    redirect(`/contacts/${cid}`);
  }

  return (
    <>
      <PageHeader
        title={c.displayName}
        subtitle={[c.kind, c.city, c.kraPin && `PIN ${c.kraPin}`, c.phone].filter(Boolean).join(" · ")}
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="They owe you" cents={owedToYou} tone={owedToYou > 0 ? "warn" : "neutral"} />
        <StatCard label="You owe them" cents={youOwe} />
        <StatCard label="Lifetime sales" cents={lifetime} tone="good" />
      </div>

      <div className="grid grid-cols-5 gap-6 mt-7">
        <div className="col-span-3">
          <h2 className="text-[15px] font-semibold mb-3">Documents</h2>
          {docs.length === 0 ? (
            <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
              Nothing yet.
            </div>
          ) : (
            <TableCard>
              <thead className="hairline-b">
                <tr><Th>Date</Th><Th>Doc</Th><Th>Status</Th><Th right>Total</Th></tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="hairline-t">
                    <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                    <Td>
                      <Link
                        href={
                          d.type === "invoice"
                            ? `/sales/invoices/${d.id}`
                            : d.type === "quote"
                            ? `/sales/quotes/${d.id}`
                            : d.type === "bill"
                            ? `/purchases/bills/${d.id}`
                            : `/purchases/expenses/${d.id}`
                        }
                        className="font-medium hover:text-[var(--color-accent-600)]"
                      >
                        {d.number}
                      </Link>
                    </Td>
                    <Td><StatusPill status={d.status} overdue={d.status === "open" && !!d.dueDate && d.dueDate < todayISO()} /></Td>
                    <Td right>{fmtKES(d.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}

          {contactDeals.length > 0 && (
            <>
              <h2 className="text-[15px] font-semibold mt-6 mb-3">Deals</h2>
              <TableCard>
                <thead className="hairline-b"><tr><Th>Deal</Th><Th>Stage</Th><Th right>Value</Th></tr></thead>
                <tbody>
                  {contactDeals.map((d) => (
                    <tr key={d.id} className="hairline-t">
                      <Td className="font-medium">{d.title}</Td>
                      <Td><StatusPill status={d.stage} /></Td>
                      <Td right>{fmtKES(d.amountCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            </>
          )}
        </div>

        <div className="col-span-2">
          <h2 className="text-[15px] font-semibold mb-3">Activity</h2>
          <form action={note} className="card p-3 mb-3">
            <div className="flex gap-2">
              <select name="kind" className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 text-[12.5px] bg-white">
                <option value="note">Note</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
              </select>
              <input
                name="content"
                placeholder="Log a note, call, meeting…"
                className="flex-1 rounded-md border border-[var(--color-ink-200)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
              />
              <button className="rounded-md bg-[var(--color-accent-500)] text-white text-[12.5px] font-medium px-3">
                Add
              </button>
            </div>
          </form>
          <div className="space-y-2">
            {acts.map((a) => (
              <div key={a.id} className="card px-4 py-3">
                <div className="text-[11px] text-[var(--color-ink-400)] capitalize">
                  {a.kind} · {a.date}
                </div>
                <div className="text-[13px] mt-0.5">{a.content}</div>
              </div>
            ))}
            {acts.length === 0 && (
              <div className="text-[12.5px] text-[var(--color-ink-400)] px-1">
                No activity yet — keep notes on calls and follow-ups here.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
