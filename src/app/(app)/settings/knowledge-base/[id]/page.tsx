import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, knowledgeArticles } from "@/db";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ArticleForm } from "@/components/ArticleForm";

export const dynamic = "force-dynamic";

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("settings");
  const o = await getOrg();
  const { id } = await params;
  
  let article = null;
  if (id !== "new") {
    const aid = Number(id);
    if (isNaN(aid)) notFound();
    const [existing] = await db.select()
      .from(knowledgeArticles)
      .where(and(eq(knowledgeArticles.orgId, o.id), eq(knowledgeArticles.id, aid)))
      .limit(1);
    
    if (!existing) notFound();
    article = existing;
  }

  return (
    <>
      <PageHeader 
        title={article ? "Edit Article" : "New Article"} 
      />

      <div className="max-w-3xl">
        <ArticleForm 
          article={article ? { id: article.id, title: article.title, content: article.content, published: article.published } : null} 
        />
      </div>
    </>
  );
}
