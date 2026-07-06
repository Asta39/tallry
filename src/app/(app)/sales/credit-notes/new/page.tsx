import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewCreditNotePage() {
  await requirePerm("credit_notes");
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New credit note" subtitle="Reverses revenue and output VAT for the lines below" />
      <DocumentEditor
        type="credit_note"
        contacts={opts.contacts}
        items={opts.items}
        backHref="/sales/credit-notes"
        detailHref="/sales/credit-notes"
      />
    </>
  );
}
