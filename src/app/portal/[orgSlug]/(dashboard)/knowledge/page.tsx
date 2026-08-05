import { getClientSession } from "@/lib/client-portal/auth";
import { db, knowledgeArticles } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/components/ui";
import { WhatsAppInquiry } from "./WhatsAppInquiry";

export const dynamic = "force-dynamic";

export default async function ClientPortalKnowledge({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const session = await getClientSession(orgSlug);
  if (!session) redirect(`/portal/${orgSlug}/login`);

  const articles = await db.select()
    .from(knowledgeArticles)
    .where(
      and(
        eq(knowledgeArticles.orgId, session.orgId),
        eq(knowledgeArticles.published, true)
      )
    )
    .orderBy(desc(knowledgeArticles.createdAt));

  return (
    <>
      <PageHeader 
        title="Help & Knowledge Base" 
        subtitle="Articles and guides to help you out. Can't find what you need? Send us a message."
      />

      <div className="flex flex-col md:flex-row gap-8 mt-6 max-w-5xl">
        <div className="flex-1 space-y-6">
          <h2 className="text-lg font-bold text-[var(--color-ink-900)]">Articles</h2>
          
          {articles.length === 0 ? (
            <div className="card px-5 py-10 flex flex-col items-center text-center text-[13.5px] text-[var(--color-ink-500)] border border-[var(--color-ink-100)]">
              <Image src="/portal/illus-question.png" alt="" width={120} height={120} className="mb-2 select-none pointer-events-none" />
              No articles have been published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map(a => (
                <div key={a.id} className="card p-5 border border-[var(--color-ink-100)] shadow-sm">
                  <h3 className="text-[15px] font-bold text-[var(--color-ink-900)] mb-2">{a.title}</h3>
                  <div className="text-[13.5px] text-[var(--color-ink-700)] whitespace-pre-wrap">{a.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="w-full md:w-80 shrink-0">
          <WhatsAppInquiry orgPhone={session.org.phone} />
        </div>
      </div>
    </>
  );
}
