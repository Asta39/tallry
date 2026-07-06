import { DocList } from "@/components/DocList";

export const dynamic = "force-dynamic";

export default function QuotesPage() {
  return (
    <DocList
      type="quote"
      title="Quotes"
      subtitle="Estimates you can convert to invoices in one click"
      basePath="/sales/quotes"
      newLabel="+ New quote"
      emptyTitle="No quotes yet"
      emptyBody="Send a quote, mark it accepted, then convert it to an invoice — the numbers carry over."
    />
  );
}
