import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, members } from "@/db";
import { eq } from "drizzle-orm";
import { listCustomerGroups } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { ContactForm } from "@/components/ContactForm";

export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  await requirePerm("contacts");
  const o = await getOrg();
  const [groups, staffMembers] = await Promise.all([
    listCustomerGroups(),
    db.select({ id: members.id, name: members.name }).from(members).where(eq(members.orgId, o.id)),
  ]);
  return (
    <>
      <PageHeader title="New contact" />
      <ContactForm
        groups={groups.map((g) => ({ id: g.id, name: g.name, parentGroupId: g.parentGroupId }))}
        groupsRequired={o.customerGroupsEnabled}
        staffMembers={staffMembers}
      />
    </>
  );
}
