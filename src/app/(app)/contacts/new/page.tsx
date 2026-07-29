import { requirePerm } from "@/lib/guard";
import { listCustomerGroups } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requirePerm("contacts");
  const groups = await listCustomerGroups();
  return (
    <>
      <PageHeader title="New contact" />
      <ContactForm groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
    </>
  );
}
