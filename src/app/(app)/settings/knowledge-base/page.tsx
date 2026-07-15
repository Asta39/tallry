import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, knowledgeArticles } from "@/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader, TableCard, Th, Td, PrimaryLink, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  await requirePerm("settings");
  const o = await getOrg();
  
  const articles = await db.select()
    .from(knowledgeArticles)
    .where(eq(knowledgeArticles.orgId, o.id))
    .orderBy(desc(knowledgeArticles.createdAt));

  return (
    <>
      <PageHeader 
        title="Knowledge Base" 
        subtitle="Manage articles that your clients can read in the Client Portal."
        backHref="/settings"
      />

      <div className="flex justify-end mb-4 max-w-4xl">
        <PrimaryLink href="/settings/knowledge-base/new">+ New Article</PrimaryLink>
      </div>

      <div className="max-w-4xl">
        {articles.length === 0 ? (
          <div className="card px-5 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
            No articles yet. Create one to help your clients!
          </div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60 cursor-pointer">
                  <Td>
                    <Link href={`/settings/knowledge-base/${a.id}`} className="font-medium hover:text-[var(--color-brand)] block">
                      {a.title}
                    </Link>
                  </Td>
                  <Td>
                    <StatusPill status={a.published ? "active" : "draft"} label={a.published ? "Published" : "Draft"} />
                  </Td>
                  <Td className="text-[var(--color-ink-500)] text-[12.5px]">{new Date(a.createdAt).toLocaleDateString()}</Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </>
  );
}
