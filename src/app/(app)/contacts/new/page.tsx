import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { listCustomerGroups } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requirePerm("contacts");
  const [o, groups] = await Promise.all([getOrg(), listCustomerGroups()]);
  return (
    <>
      <PageHeader title="New contact" />
      <ContactForm
        groups={groups.map((g) => ({ id: g.id, name: g.name, parentGroupId: g.parentGroupId }))}
        groupsRequired={o.customerGroupsEnabled}
      />
    </>
  );
}
