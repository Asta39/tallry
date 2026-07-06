import { DocDetail } from "@/components/DocDetail";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("purchase_orders");
  const { id } = await params;
  return <DocDetail id={Number(id)} />;
}
