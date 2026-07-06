import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requirePerm("invoices");
  return (
    <DocList
      type="invoice"
      title="Invoices"
      basePath="/sales/invoices"
      newLabel="+ New invoice"
      emptyTitle="No invoices yet"
      emptyBody="Create an invoice and it will carry KRA eTIMS details automatically — VAT, CU number and a verification QR code."
    />
  );
}
