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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)]">Welcome back</h1>
        <p className="text-[14px] text-[var(--color-ink-600)] mt-1">Here is what's happening with your account.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Action Needed Card */}
        <div className="card p-6 border border-[var(--color-ink-100)] shadow-sm">
          <h2 className="text-[15px] font-semibold mb-4">Action Needed</h2>
          {unpaidInvoices.length === 0 ? (
            <div className="text-[13.5px] text-[var(--color-ink-500)]">You're all caught up! No pending invoices to pay.</div>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
           <div className="card p-5 border border-[var(--color-ink-100)] shadow-sm flex flex-col justify-center">
             <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium mb-2">Unpaid Invoices</h3>
             <div className="text-3xl font-semibold text-[var(--color-ink-900)]">{unpaidInvoices.length}</div>
           </div>
           <div className="card p-5 border border-[var(--color-ink-100)] shadow-sm flex flex-col justify-center">
             <h3 className="text-[13px] text-[var(--color-ink-500)] font-medium mb-2">Active Quotes</h3>
             <div className="text-3xl font-semibold text-[var(--color-ink-900)]">{activeQuotes.length}</div>
           </div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-[16px] font-semibold text-[var(--color-ink-900)]">Recent Documents</h2>
          <Link href={`/portal/${orgSlug}/documents`} className="text-[13px] text-[var(--color-brand)] font-medium hover:underline">
            View all documents &rarr;
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
