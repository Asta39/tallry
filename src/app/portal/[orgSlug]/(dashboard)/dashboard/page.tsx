import { getClientSession } from "@/lib/client-portal/auth";
import { db, documents, knowledgeArticles } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";
import { StatusPill } from "@/components/ui";

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
    .orderBy(desc(documents.date))
    .limit(5);

  const unpaidInvoices = recentDocs.filter(d => d.type === "invoice" && ["open", "partial"].includes(d.status));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)]">Welcome back</h1>
        <p className="text-[14px] text-[var(--color-ink-600)] mt-1">Here is what's happening with your account.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border border-[var(--color-ink-100)] shadow-sm">
          <h2 className="text-[15px] font-semibold mb-4">Action Needed</h2>
          {unpaidInvoices.length === 0 ? (
            <div className="text-[13.5px] text-[var(--color-ink-500)]">You're all caught up! No pending invoices to pay.</div>
          ) : (
            <div className="space-y-3">
              {unpaidInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-[var(--color-ink-50)] rounded-lg">
                  <div>
                    <div className="font-medium text-[13.5px]">{inv.number}</div>
                    <div className="text-[12.5px] text-[var(--color-ink-500)] mt-0.5">Due {inv.dueDate}</div>
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

        <div className="card p-6 border border-[var(--color-ink-100)] shadow-sm">
          <h2 className="text-[15px] font-semibold mb-4">Recent Documents</h2>
          {recentDocs.length === 0 ? (
            <div className="text-[13.5px] text-[var(--color-ink-500)]">No recent quotes or invoices.</div>
          ) : (
            <div className="space-y-3">
              {recentDocs.slice(0, 5).map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border border-[var(--color-ink-100)] rounded-lg">
                  <div>
                    <div className="font-medium text-[13.5px] capitalize">{doc.type} {doc.number}</div>
                    <div className="text-[12.5px] text-[var(--color-ink-500)] mt-0.5">{doc.date}</div>
                  </div>
                  <StatusPill status={doc.status} />
                </div>
              ))}
              <div className="pt-2 text-right">
                <Link href={`/portal/${orgSlug}/documents`} className="text-[13px] text-[var(--color-brand)] font-medium hover:underline">
                  View all documents &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
