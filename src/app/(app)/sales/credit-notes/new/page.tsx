import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ contact?: string }>;
}) {
  await requirePerm("credit_notes");
  const { contact } = await searchParams;
  const defaultContactId = contact ? Number(contact) : null;
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New credit note" subtitle="Reverses revenue and output VAT for the lines below" />
      <DocumentEditor
        type="credit_note"
        customDocumentColumnName={opts.customDocumentColumnName}
        members={opts.members}
        contacts={opts.contacts}
        items={opts.items}
        defaultContactId={defaultContactId}
        backHref="/sales/credit-notes"
        detailHref="/sales/credit-notes"
      />
    </>
  );
}
