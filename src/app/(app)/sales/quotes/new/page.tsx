import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions, fetchInitialData } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string; templateId?: string }>;
}) {
  await requirePerm("quotes");
  const { contact, templateId } = await searchParams;
  const defaultContactId = contact ? Number(contact) : null;
  const opts = await editorOptions("sale");

  let initialData = undefined;
  if (templateId) {
    try {
      const data = await fetchInitialData(Number(templateId));
      initialData = { ...data, id: undefined, isTemplate: undefined }; // clear ID and isTemplate so it saves as a new normal document
    } catch (err) {}
  }
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
        initialData={initialData as any}
        backHref="/sales/quotes"
        detailHref="/sales/quotes"
      />
    </>
  );
}
