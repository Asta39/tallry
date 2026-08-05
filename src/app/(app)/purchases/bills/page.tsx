import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";
import { listUncategorizedSpendLines } from "@/lib/category-reconcile";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requirePerm("bills");
  const sp = await searchParams;
  const uncategorized = await listUncategorizedSpendLines().catch(() => []);
  return (
    <>
      {uncategorized.length > 0 && (
        <Link
          href="/purchases/reconcile-categories"
          className="block mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] font-medium text-amber-800 hover:bg-amber-100 transition-colors"
        >
          {uncategorized.length} bill line{uncategorized.length === 1 ? "" : "s"} posted with no category — reconcile now →
        </Link>
      )}
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
    </>
  );
}
