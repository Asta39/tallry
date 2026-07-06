import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  await requirePerm("quotes");
  const opts = await editorOptions("sale");
  return (
    <>
      <PageHeader title="New quote" />
      <DocumentEditor
        type="quote"
        contacts={opts.contacts}
        items={opts.items}
        backHref="/sales/quotes"
        detailHref="/sales/quotes"
      />
    </>
  );
}
