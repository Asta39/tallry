import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { listCustomerGroupsWithCounts } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { GroupsClient } from "./GroupsClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerGroupsPage() {
  await requirePerm("contacts");
  const access = await getAccess();
  const canManage = !!access && (access.isOwner || access.role === "admin");
  const groups = await listCustomerGroupsWithCounts();

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/contacts" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Contacts
        </Link>
      </div>
      <PageHeader
        title="Customer Groups"
        subtitle="Segment customers (Wholesale, Retail, NGOs…) to break reports down by group. Every customer must belong to one."
      />
      <GroupsClient groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.memberCount }))} canManage={canManage} />
    </>
  );
}
