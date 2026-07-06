import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions } from "@/components/docData";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requirePerm("expenses");
  const opts = await editorOptions("purchase");
  return (
    <>
      <PageHeader title="New expense" subtitle="Paid immediately from bank, M-Pesa or cash" />
      <DocumentEditor
        type="expense"
        contacts={opts.contacts}
        items={[]}
        expenseAccounts={opts.expenseAccounts}
        bankAccounts={opts.bankAccounts}
        backHref="/purchases/expenses"
        detailHref="/purchases/expenses"
      />
    </>
  );
}
