import { getClientSession } from "@/lib/client-portal/auth";
import { db, documents } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

function StatIcon({ name }: { name: "invoice" | "quote" | "balance" | "activity" }) {
  const paths: Record<string, React.ReactNode> = {
    invoice: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    quote: <><path d="M7 8h10M7 12h10M7 16h6" /><rect x="3" y="4" width="18" height="16" rx="2" /></>,
    balance: <><path d="M12 2v20M17 5H9.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5H7" /></>,
    activity: <><polyline points="3 12 8 12 10 18 14 6 16 12 21 12" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export default async function ClientPortalDashboard({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getClientSession(orgSlug);
  if (!session) redirect(`/portal/${orgSlug}/login`);

  const recentDocs = await db.select()
    .from(documents)
    .where(
      and(
        eq(documents.orgId, session.orgId),
        eq(documents.contactId, session.contactId),
        inArray(documents.type, ["invoice", "quote"])
      )
    )
    .orderBy(desc(documents.date), desc(documents.id))
    .limit(5);

  const unpaidInvoices = recentDocs.filter(d => d.type === "invoice" && ["open", "partial"].includes(d.status));
  const activeQuotes = recentDocs.filter(d => d.type === "quote" && d.status === "open");

  const totalOutstandingCents = unpaidInvoices.reduce((s, d) => s + (d.totalCents - d.paidCents), 0);

  const stats = [
    { label: "Unpaid Invoices", value: String(unpaidInvoices.length), icon: "invoice" as const },
    { label: "Active Quotes", value: String(activeQuotes.length), icon: "quote" as const },
    { label: "Outstanding Balance", value: fmtKES(totalOutstandingCents), icon: "balance" as const },
    { label: "Recent Activity", value: String(recentDocs.length), icon: "activity" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-bold text-[var(--color-ink-900)] tracking-tight">Client Dashboard</h1>
        <Link
          href={`/portal/${orgSlug}/documents`}
          className="px-4 py-2.5 bg-[var(--color-ink-900)] text-white text-[13px] font-semibold rounded-full hover:bg-black transition-colors"
        >
          View all documents
        </Link>
      </div>

      {/* Bento grid: spotlight action card (spans 2 rows) + icon-badge stat tiles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:row-span-2 p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-accent-100)] text-[var(--color-accent-700)] flex items-center justify-center shrink-0">
              <StatIcon name="invoice" />
            </div>
            <h2 className="text-[16px] font-bold">Action Needed</h2>
          </div>
          <p className="text-[12.5px] text-[var(--color-ink-500)] mb-4">Invoices awaiting your payment.</p>
          {unpaidInvoices.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Image src="/portal/illus-team.png" alt="" width={160} height={160} className="mb-2 select-none pointer-events-none" />
              <div className="text-[13.5px] text-[var(--color-ink-500)]">You're all caught up.</div>
              <div className="text-[12px] text-[var(--color-ink-400)] mt-1">No pending invoices to pay.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-2xl">
                  <div>
                    <div className="font-medium text-[13.5px] text-[var(--color-ink-900)]">{inv.number}</div>
                    <div className="text-[12.5px] text-[var(--color-ink-500)] mt-0.5">Due {inv.dueDate} &middot; {fmtKES(inv.totalCents - inv.paidCents)}</div>
                  </div>
                  <Link
                    href={`/portal/${orgSlug}/documents`}
                    className="px-4 py-1.5 bg-[var(--color-brand)] text-white text-[12.5px] font-semibold rounded-full shadow-sm hover:opacity-90"
                  >
                    Pay Now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {stats.map((s) => (
          <div key={s.label} className="card p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-ink-50)] text-[var(--color-ink-600)] flex items-center justify-center">
              <StatIcon name={s.icon} />
            </div>
            <div>
              <h3 className="text-[12.5px] text-[var(--color-ink-500)] font-medium mb-1">{s.label}</h3>
              <div className="money-lg text-[var(--color-ink-900)]">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[16px] font-bold text-[var(--color-ink-900)]">Recent Documents</h2>
          <Link href={`/portal/${orgSlug}/documents`} className="text-[13px] text-[var(--color-brand)] font-medium hover:underline">
            View all &rarr;
          </Link>
        </div>
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Number</Th>
              <Th>Status</Th>
              <Th right>Total</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {recentDocs.map((d) => (
              <tr key={d.id} className="hairline-t">
                <Td className="text-[var(--color-ink-500)]">{d.date}</Td>
                <Td className="font-medium capitalize">{d.type} {d.number}</Td>
                <Td><StatusPill status={d.status} /></Td>
                <Td right>{fmtKES(d.totalCents)}</Td>
                <Td right>
                  <div className="flex justify-end gap-2">
                    <a
                      href={`/portal/${orgSlug}/api/pdf/${d.id}`}
                      target="_blank"
                      className="px-3 py-1 border border-[var(--color-ink-200)] text-[12px] font-medium text-[var(--color-ink-700)] rounded-md hover:bg-[var(--color-ink-50)] transition-all"
                    >
                      View PDF
                    </a>
                    <a
                      href={`/portal/${orgSlug}/api/pdf/${d.id}?download=1`}
                      className="px-3 py-1 bg-[var(--color-ink-900)] text-white text-[12px] font-medium rounded-md hover:bg-black transition-all"
                    >
                      Download
                    </a>
                  </div>
                </Td>
              </tr>
            ))}
            {recentDocs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-[13px] text-[var(--color-ink-400)]">
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </div>
    </div>
  );
}
