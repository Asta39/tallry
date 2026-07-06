import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  await requirePerm("invoices");
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New invoice" subtitle="VAT is calculated per line, the KRA way" />
      <DocumentEditor
        type="invoice"
        contacts={opts.contacts}
        items={opts.items}
        backHref="/sales/invoices"
        detailHref="/sales/invoices"
      />
    </>
  );
}
