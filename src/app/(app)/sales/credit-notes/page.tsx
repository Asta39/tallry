import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await requirePerm("credit_notes");
  const sp = await searchParams;
  return (
    <DocList
      type="credit_note"
      title="Credit notes"
      searchParams={sp}
      subtitle="Refunds and corrections — they reduce what customers owe you"
      basePath="/sales/credit-notes"
      newLabel="+ New credit note"
      emptyTitle="No credit notes yet"
      emptyBody="Issue a credit note when you refund a customer or correct an invoice. It reverses the sale and VAT in your books."
    />
  );
}
