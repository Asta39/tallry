import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  await requirePerm("invoices");
  const { contact } = await searchParams;
  const defaultContactId = contact ? Number(contact) : null;
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New invoice" subtitle="VAT is calculated per line, the KRA way" />
      <DocumentEditor
        type="invoice"
        customDocumentColumnName={opts.customDocumentColumnName}
        members={opts.members}
        contacts={opts.contacts}
        items={opts.items}
        defaultContactId={defaultContactId}
        backHref="/sales/invoices"
        detailHref="/sales/invoices"
      />
    </>
  );
}
