import { getClientSession } from "@/lib/client-portal/auth";
import { db, deals } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PageHeader, StatusPill, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ClientPortalDeals({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getClientSession(orgSlug);
  if (!session) redirect(`/portal/${orgSlug}/login`);

  const contactDeals = await db.select()
    .from(deals)
    .where(
      and(
        eq(deals.orgId, session.orgId),
        eq(deals.contactId, session.contactId)
      )
    )
    .orderBy(desc(deals.createdAt));

  return (
    <>
      <PageHeader 
        title="Projects & Deals" 
        subtitle="Track the progress of our ongoing engagements."
      />

      <div className="max-w-4xl mt-6">
        {contactDeals.length === 0 ? (
          <div className="card px-5 py-12 text-center text-[13.5px] text-[var(--color-ink-500)] border border-[var(--color-ink-100)]">
            You don't have any active projects or deals at the moment.
          </div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Project / Deal</Th>
                <Th>Status</Th>
                <Th>Started</Th>
              </tr>
            </thead>
            <tbody>
              {contactDeals.map((d) => (
                <tr key={d.id} className="hairline-t">
                  <Td className="font-medium">{d.title}</Td>
                  <Td>
                    <StatusPill status={d.stage} />
                  </Td>
                  <Td className="text-[var(--color-ink-500)] text-[12.5px]">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </>
  );
}
