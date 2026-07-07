import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function QuoteTemplatesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  await requirePerm("quotes");
  return (
    <>
      <DocList
        type="quote"
        title="Quote Templates"
        searchParams={sp}
        subtitle="Save frequently used quotes to quickly create new ones"
        basePath="/sales/quotes"
        newLabel="+ New template"
        newHref="/sales/quotes/new?saveAsTemplate=true"
        emptyTitle="No templates yet"
        emptyBody="Create a quote template to quickly reuse standard items and pricing for future quotes."
        isTemplate={true}
      />
    </>
  );
}
