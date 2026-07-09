import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, recurringTemplates, contacts, bankAccounts } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { RecurringManager, type RecurringRow } from "@/components/RecurringManager";
import { computeDocument, type TaxClass } from "@/lib/tax";
import type { DocLineInput } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  await requirePerm("accountant");
  const o = await getOrg();

  const templates = await db
    .select()
    .from(recurringTemplates)
    .where(eq(recurringTemplates.orgId, o.id))
    .orderBy(desc(recurringTemplates.createdAt));

  const allContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.orgId, o.id));

  const banks = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false)));

  const rows: RecurringRow[] = templates.map((t) => {
    const contact = t.contactId ? allContacts.find((c) => c.id === t.contactId) : null;
    const lines: DocLineInput[] = JSON.parse(t.linesJson);
    const { totalCents } = computeDocument(lines.map((l) => ({
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      taxClass: (l.taxClass || "B16") as TaxClass,
    })), t.taxInclusive);

    return {
      id: t.id,
      name: t.name,
      docType: t.docType,
      contactName: contact?.displayName ?? null,
      frequency: t.frequency,
      nextRunDate: t.nextRunDate,
      autoIssue: t.autoIssue,
      active: t.active,
      totalCents,
      lastRunAt: t.lastRunAt,
    };
  });

  return (
    <>
      <PageHeader
        title="Recurring Templates"
        subtitle="Automatically generate invoices, bills, or expenses on a schedule"
      />
      <RecurringManager
        rows={rows}
        contacts={allContacts.map((c) => ({ id: c.id, label: c.displayName }))}
        bankAccounts={banks.map((b) => ({ id: b.id, label: b.name }))}
      />
    </>
  );
}
