import { DocDetail } from "@/components/DocDetail";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices");
  const { id } = await params;
  return <DocDetail id={Number(id)} printHref={`/sales/invoices/${id}/print`} />;
}
