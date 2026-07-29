import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, contacts } from "@/db";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { listCustomerGroups } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("contacts");
  const o = await getOrg();
  const { id } = await params;
  const [c] = await db.select().from(contacts).where(and(eq(contacts.orgId, o.id), eq(contacts.id, Number(id)))).limit(1);
  if (!c) notFound();

  const groups = await listCustomerGroups();

  return (
    <>
      <PageHeader title={`Edit ${c.displayName}`} />
      <ContactForm
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        initial={{
          id: c.id,
          kind: c.kind,
          displayName: c.displayName,
          companyName: c.companyName,
          email: c.email,
          phone: c.phone,
          kraPin: c.kraPin,
          address: c.address,
          city: c.city,
          notes: c.notes,
          isWithholdingAgent: c.isWithholdingAgent,
          groupId: c.groupId,
        }}
      />
    </>
  );
}
