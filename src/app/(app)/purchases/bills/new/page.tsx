import { DocumentEditor } from "@/components/DocumentEditor";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewBillPage() {
  const opts = await editorOptions("purchase");
  return (
    <>
      <PageHeader title="New bill" subtitle="Buying stock items adds them to inventory at FIFO cost" />
      <DocumentEditor
        type="bill"
        contacts={opts.contacts}
        items={opts.items}
        expenseAccounts={opts.expenseAccounts}
        backHref="/purchases/bills"
        detailHref="/purchases/bills"
      />
    </>
  );
}
