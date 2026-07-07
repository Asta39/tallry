import { eq, and, desc } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db, contacts, documents, activities, deals, payments } from "@/db";
import { fmtKES, todayISO } from "@/lib/money";
import { addActivity } from "@/lib/actions";
import { PageHeader, StatusPill, StatCard, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import { StatementTab } from "@/components/StatementTab";

export const dynamic = "force-dynamic";

/**
 * Customer/vendor workspace — mini sidebar with contact-scoped views.
 * Everything created here also appears in the main module tabs; this is
 * just a filtered lens on the same data.
 */

const TABS = [
  { key: "overview", label: "Overview", icon: "◧" },
  { key: "invoices", label: "Invoices", icon: "▦", docType: "invoice", newHref: "/sales/invoices/new" },
  { key: "quotes", label: "Quotes", icon: "✎", docType: "quote", newHref: "/sales/quotes/new" },
  { key: "credit_notes", label: "Credit notes", icon: "⊟", docType: "credit_note", newHref: "/sales/credit-notes/new" },
  { key: "bills", label: "Bills", icon: "▧", docType: "bill", newHref: "/purchases/bills/new" },
  { key: "deals", label: "Deals", icon: "▤" },
  { key: "statement", label: "Statement", icon: "📄" },
  { key: "notes", label: "Notes & activity", icon: "≡" },
] as const;

function docHref(type: string, id: number) {
  const map: Record<string, string> = {
    invoice: `/sales/invoices/${id}`,
    quote: `/sales/quotes/${id}`,
    credit_note: `/sales/credit-notes/${id}`,
    bill: `/purchases/bills/${id}`,
    expense: `/purchases/expenses/${id}`,
    purchase_order: `/purchases/orders/${id}`,
  };
  return map[type] ?? "#";
}

export default async function ContactDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePerm("contacts");
  const o = await getOrg();
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const cid = Number(id);
  const [c] = await db.select().from(contacts).where(and(eq(contacts.orgId, o.id), eq(contacts.id, cid))).limit(1);
  if (!c) notFound();

  const isVendor = c.kind === "vendor" || c.kind === "both";
  const isCustomer = c.kind === "customer" || c.kind === "both";
  const visibleTabs = TABS.filter((t) => {
    if (["invoices", "quotes", "credit_notes"].includes(t.key)) return isCustomer;
    if (t.key === "bills") return isVendor;
    return true;
  });
  const tab = visibleTabs.some((t) => t.key === tabParam) ? tabParam! : "overview";

  const allDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, o.id), eq(documents.contactId, cid)))
    .orderBy(desc(documents.date), desc(documents.id));
  const acts = await db
    .select()
    .from(activities)
    .where(and(eq(activities.orgId, o.id), eq(activities.contactId, cid)))
    .orderBy(desc(activities.createdAt));
  const contactDeals = await db.select().from(deals).where(and(eq(deals.orgId, o.id), eq(deals.contactId, cid)));
  const contactPayments = await db.select().from(payments).where(and(eq(payments.orgId, o.id), eq(payments.contactId, cid)));

  const owedToYou = allDocs
    .filter((d) => d.type === "invoice" && ["open", "partial"].includes(d.status))
    .reduce((s, d) => s + d.totalCents - d.paidCents, 0);
  const youOwe = allDocs
    .filter((d) => d.type === "bill" && ["open", "partial"].includes(d.status))
    .reduce((s, d) => s + d.totalCents - d.paidCents, 0);
  const lifetime = allDocs
    .filter((d) => d.type === "invoice" && !["draft", "void"].includes(d.status))
    .reduce((s, d) => s + d.totalCents, 0);

  async function note(formData: FormData) {
    "use server";
    const content = String(formData.get("content") || "").trim();
    if (content) await addActivity(cid, String(formData.get("kind") || "note"), content);
    redirect(`/contacts/${cid}?tab=notes`);
  }

  const activeTabDef = TABS.find((t) => t.key === tab);
  const today = todayISO();

  const DocTable = ({ type, newHref, newLabel }: { type: string; newHref: string; newLabel: string }) => {
    const rows = allDocs.filter((d) => d.type === type);
    return (
      <>
        <div className="flex justify-end mb-3">
          <PrimaryLink href={`${newHref}?contact=${cid}`}>{newLabel}</PrimaryLink>
        </div>
        {rows.length === 0 ? (
          <div className="card px-5 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
            Nothing for {c.displayName} yet.
          </div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr><Th>Date</Th><Th>Number</Th><Th>Status</Th><Th right>Total</Th><Th right>Balance</Th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                  <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                  <Td>
                    <Link href={docHref(d.type, d.id)} className="font-medium hover:text-[var(--color-accent-600)]">
                      {d.number}
                    </Link>
                  </Td>
                  <Td><StatusPill status={d.status} overdue={d.status === "open" && !!d.dueDate && d.dueDate < today} /></Td>
                  <Td right>{fmtKES(d.totalCents)}</Td>
                  <Td right className="font-medium">
                    {["open", "partial"].includes(d.status) ? fmtKES(d.totalCents - d.paidCents) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={c.displayName}
        subtitle={[c.kind, c.city, c.kraPin && `PIN ${c.kraPin}`, c.phone].filter(Boolean).join(" · ")}
      />

      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Mini sidebar */}
        <nav className="w-full md:w-[180px] shrink-0 md:sticky md:top-6">
          <ul className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
            {visibleTabs.map((t) => (
              <li key={t.key} className="shrink-0">
                <Link
                  href={`/contacts/${cid}?tab=${t.key}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap transition-colors ${
                    tab === t.key
                      ? "bg-white text-[var(--color-accent-700)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06)] border-[0.5px] border-[var(--color-ink-100)]"
                      : "text-[var(--color-ink-600)] hover:bg-white/60"
                  }`}
                >
                  <span className="opacity-70">{t.icon}</span>
                  {t.label}
                  {"docType" in t && (
                    <span className="ml-auto text-[11px] text-[var(--color-ink-400)] tnum">
                      {allDocs.filter((d) => d.type === t.docType).length || ""}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0 w-full">
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="They owe you" cents={owedToYou} tone={owedToYou > 0 ? "warn" : "neutral"} />
                <StatCard label="You owe them" cents={youOwe} />
                <StatCard label="Lifetime sales" cents={lifetime} tone="good" />
              </div>
              <h2 className="text-[15px] font-semibold mt-6 mb-3">Recent documents</h2>
              {allDocs.length === 0 ? (
                <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">Nothing yet.</div>
              ) : (
                <TableCard>
                  <thead className="hairline-b">
                    <tr><Th>Date</Th><Th>Doc</Th><Th>Status</Th><Th right>Total</Th></tr>
                  </thead>
                  <tbody>
                    {allDocs.slice(0, 10).map((d) => (
                      <tr key={d.id} className="hairline-t">
                        <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                        <Td>
                          <Link href={docHref(d.type, d.id)} className="font-medium hover:text-[var(--color-accent-600)]">
                            {d.number}
                          </Link>
                        </Td>
                        <Td><StatusPill status={d.status} overdue={d.status === "open" && !!d.dueDate && d.dueDate < today} /></Td>
                        <Td right>{fmtKES(d.totalCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableCard>
              )}
            </>
          )}

          {tab === "invoices" && <DocTable type="invoice" newHref="/sales/invoices/new" newLabel={`+ Invoice ${c.displayName.split(" ")[0]}`} />}
          {tab === "quotes" && <DocTable type="quote" newHref="/sales/quotes/new" newLabel="+ New quote" />}
          {tab === "credit_notes" && <DocTable type="credit_note" newHref="/sales/credit-notes/new" newLabel="+ New credit note" />}
          {tab === "bills" && <DocTable type="bill" newHref="/purchases/bills/new" newLabel="+ New bill" />}

          {tab === "deals" && (
            <>
              <div className="flex justify-end mb-3">
                <PrimaryLink href="/pipeline">Open pipeline →</PrimaryLink>
              </div>
              {contactDeals.length === 0 ? (
                <div className="card px-5 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
                  No deals with {c.displayName} — add one from the pipeline.
                </div>
              ) : (
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
              )}
            </>
          )}

          {tab === "statement" && <StatementTab contact={c} docs={allDocs} pays={contactPayments} />}

          {tab === "notes" && (
            <>
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
                    className="flex-1 min-w-0 rounded-md border border-[var(--color-ink-200)] px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]"
                  />
                  <button className="rounded-md bg-[var(--color-accent-500)] text-white text-[12.5px] font-medium px-3">Add</button>
                </div>
              </form>
              <div className="space-y-2">
                {acts.map((a) => (
                  <div key={a.id} className="card px-4 py-3">
                    <div className="text-[11px] text-[var(--color-ink-400)] capitalize">{a.kind} · {a.date}</div>
                    <div className="text-[13px] mt-0.5">{a.content}</div>
                  </div>
                ))}
                {acts.length === 0 && (
                  <div className="text-[12.5px] text-[var(--color-ink-400)] px-1">
                    No activity yet — keep notes on calls and follow-ups here.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
