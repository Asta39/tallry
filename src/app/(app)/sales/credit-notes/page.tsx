import { DocList } from "@/components/DocList";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function CreditNotesPage() {
  await requirePerm("credit_notes");
  return (
    <DocList
      type="credit_note"
      title="Credit notes"
      subtitle="Refunds and corrections — they reduce what customers owe you"
      basePath="/sales/credit-notes"
      newLabel="+ New credit note"
      emptyTitle="No credit notes yet"
      emptyBody="Issue a credit note when you refund a customer or correct an invoice. It reverses the sale and VAT in your books."
    />
  );
}
