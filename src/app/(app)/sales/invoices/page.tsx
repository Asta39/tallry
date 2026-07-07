import { DocList } from "@/components/DocList";
import { CsvImporter } from "@/components/CsvImporter";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requirePerm("invoices");
  const sp = await searchParams;
  return (
    <>
    <div className="mb-4 flex justify-end"><CsvImporter entity="invoices" label="Bulk import invoices" /></div>
    <DocList
      type="invoice"
      title="Invoices"
      searchParams={sp}
      basePath="/sales/invoices"
      newLabel="+ New invoice"
      emptyTitle="No invoices yet"
      emptyBody="Create an invoice and it will carry KRA eTIMS details automatically — VAT, CU number and a verification QR code."
    />
    </>
  );
}
