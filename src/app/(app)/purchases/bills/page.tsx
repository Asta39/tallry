import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requirePerm("bills");
  const sp = await searchParams;
  return (
    <DocList
      type="bill"
      title="Bills"
      searchParams={sp}
      subtitle="Vendor invoices you'll pay later"
      basePath="/purchases/bills"
      newLabel="+ New bill"
      emptyTitle="No bills yet"
      emptyBody="Record what vendors invoice you. Input VAT is tracked automatically so your VAT return claims everything you're entitled to."
    />
  );
}
