import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  await requirePerm("bills");
  return (
    <DocList
      type="bill"
      title="Bills"
      subtitle="Vendor invoices you'll pay later"
      basePath="/purchases/bills"
      newLabel="+ New bill"
      emptyTitle="No bills yet"
      emptyBody="Record what vendors invoice you. Input VAT is tracked automatically so your VAT return claims everything you're entitled to."
    />
  );
}
