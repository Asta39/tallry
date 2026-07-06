import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  await requirePerm("purchase_orders");
  return (
    <DocList
      type="purchase_order"
      title="Purchase orders"
      subtitle="Commit to buying — convert to a bill when goods arrive"
      basePath="/purchases/orders"
      newLabel="+ New purchase order"
      emptyTitle="No purchase orders yet"
      emptyBody="Send a PO to your supplier. Nothing posts to your books until you convert it to a bill on delivery."
    />
  );
}
