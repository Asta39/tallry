import { DocList } from "@/components/DocList";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
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
