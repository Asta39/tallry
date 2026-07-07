import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  await requirePerm("quotes");
  return (
    <DocList
      type="quote"
      title="Quotes"
      searchParams={sp}
      subtitle="Estimates you can convert to invoices in one click"
      basePath="/sales/quotes"
      newLabel="+ New quote"
      emptyTitle="No quotes yet"
      emptyBody="Send a quote, mark it accepted, then convert it to an invoice — the numbers carry over."
    />
  );
}
