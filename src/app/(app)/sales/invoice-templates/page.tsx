import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function InvoiceTemplatesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  await requirePerm("invoices");
  return (
    <>
      <DocList
        type="invoice"
        title="Invoice Templates"
        searchParams={sp}
        subtitle="Save frequently used invoices to quickly create new ones"
        basePath="/sales/invoices"
        newLabel="+ New template"
        newHref="/sales/invoices/new?saveAsTemplate=true"
        emptyTitle="No templates yet"
        emptyBody="Create an invoice template to quickly reuse standard items and pricing for future invoices."
        isTemplate={true}
      />
    </>
  );
}
