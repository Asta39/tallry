import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function QuoteTemplatesPage() {
  await requirePerm("quotes");
  return (
    <>
      <DocList
        type="quote"
        title="Quote Templates"
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
