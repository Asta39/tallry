import { getClientSession } from "@/lib/client-portal/auth";
import { db, documents } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)] tracking-tight">Client Dashboard</h1>
        <Link
          href={`/portal/${orgSlug}/documents`}
          className="px-4 py-2 bg-[var(--color-ink-900)] text-white text-[13px] font-medium rounded-full hover:bg-black transition-colors"
        >
          View all documents
        </Link>
      </div>

      {/* Card grid: spotlight action card (spans 2 rows) + stat tiles alongside it */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:row-span-2 p-6 flex flex-col">
          <h2 className="text-[15px] font-semibold mb-1">Action Needed</h2>
          <p className="text-[12.5px] text-[var(--color-ink-500)] mb-4">Invoices awaiting your payment.</p>
          {unpaidInvoices.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <div className="text-[13.5px] text-[var(--color-ink-500)]">You're all caught up.</div>
                <div className="text-[12px] text-[var(--color-ink-400)] mt-1">No pending invoices to pay.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-red-50/50 border border-red-100 rounded-lg">
                  <div>
                    <div className="font-medium text-[13.5px] text-[var(--color-ink-900)]">{inv.number}</div>
                    <div className="text-[12.5px] text-[var(--color-ink-500)] mt-0.5">Due {inv.dueDate} &middot; {fmtKES(inv.totalCents - inv.paidCents)}</div>
                  </div>
                  <Link
                    href={`/portal/${orgSlug}/documents`}
                    className="px-4 py-1.5 bg-[var(--color-brand)] text-white text-[12.5px] font-semibold rounded-md shadow-sm hover:opacity-90"
                  >
                    Pay Now
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 flex flex-col justify-between">
          <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium">Unpaid Invoices</h3>
          <div className="money-lg text-[var(--color-ink-900)]">{unpaidInvoices.length}</div>
        </div>
        <div className="card p-5 flex flex-col justify-between">
          <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium">Active Quotes</h3>
          <div className="money-lg text-[var(--color-ink-900)]">{activeQuotes.length}</div>
        </div>
        <div className="card p-5 flex flex-col justify-between">
          <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium">Outstanding Balance</h3>
          <div className="money-lg text-[var(--color-ink-900)]">{fmtKES(totalOutstandingCents)}</div>
        </div>
        <div className="card p-5 flex flex-col justify-between">
          <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium">Recent Activity</h3>
          <div className="money-lg text-[var(--color-ink-900)]">{recentDocs.length}</div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[15px] font-semibold text-[var(--color-ink-900)]">Recent Documents</h2>
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
