import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  await requirePerm("quotes");
  const { contact } = await searchParams;
  const defaultContactId = contact ? Number(contact) : null;
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New quote" />
      <DocumentEditor
        type="quote"
        customDocumentColumnName={opts.customDocumentColumnName}
        members={opts.members}
        contacts={opts.contacts}
        items={opts.items}
        defaultContactId={defaultContactId}
        backHref="/sales/quotes"
        detailHref="/sales/quotes"
      />
    </>
  );
}
