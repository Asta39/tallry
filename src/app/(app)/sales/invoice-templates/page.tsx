import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function InvoiceTemplatesPage() {
  await requirePerm("invoices");
  return (
    <>
      <DocList
        type="invoice"
        title="Invoice Templates"
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
