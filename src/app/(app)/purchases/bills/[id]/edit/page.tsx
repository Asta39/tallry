import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions, fetchInitialData } from "@/components/docData";
import { PageHeader } from "@/components/ui";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditBillPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("bills");
  const { id } = await params;
  const docId = Number(id);
  if (isNaN(docId)) notFound();

  const opts = await editorOptions("purchase");
  let initialData;
  try {
    initialData = await fetchInitialData(docId);
  } catch {
    notFound();
  }
  if (initialData.type !== "bill") notFound();
  if (!["draft", "pending_approval", "open"].includes(initialData.status)) redirect(`/purchases/bills/${docId}`);

  return (
    <>
      <PageHeader
        title="Edit bill"
        subtitle={initialData.status === "open" ? "Saving re-posts this bill with the new amounts — it hasn't been paid yet" : undefined}
      />
      <DocumentEditor
        type="bill"
        customDocumentColumnName={opts.customDocumentColumnName}
        members={opts.members}
        contacts={opts.contacts}
        customers={opts.customers}
        items={opts.items}
        itemGroups={opts.itemGroups}
        itemGroupsRequired={opts.itemGroupsRequired}
        costCenters={opts.costCenters}
        warehouses={opts.warehouses}
        expenseAccounts={opts.expenseAccounts}
        vendorPayouts={opts.vendorPayouts}
        backHref={`/purchases/bills/${docId}`}
        detailHref="/purchases/bills"
        initialData={initialData as any}
      />
    </>
  );
}
