import { DocumentEditor } from "@/components/DocumentEditor";
import { requirePerm } from "@/lib/guard";
import { editorOptions, fetchInitialData } from "@/components/docData";
import { PageHeader } from "@/components/ui";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("purchase_orders");
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
  if (initialData.type !== "purchase_order") notFound();
  if (!["draft", "open"].includes(initialData.status)) redirect(`/purchases/orders/${docId}`);

  return (
    <>
      <PageHeader title="Edit purchase order" subtitle="No accounting effect until converted to a bill" />
      <DocumentEditor
        type="purchase_order"
        customDocumentColumnName={opts.customDocumentColumnName}
        members={opts.members}
        contacts={opts.contacts}
        items={opts.items}
        itemGroups={opts.itemGroups}
        itemGroupsRequired={opts.itemGroupsRequired}
        costCenters={opts.costCenters}
        warehouses={opts.warehouses}
        expenseAccounts={opts.expenseAccounts}
        vendorPayouts={opts.vendorPayouts}
        backHref={`/purchases/orders/${docId}`}
        detailHref="/purchases/orders"
        initialData={initialData as any}
      />
    </>
  );
}
