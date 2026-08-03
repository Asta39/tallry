import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { getOrg } from "@/lib/org";
import { listCustomerGroupsWithCounts } from "@/lib/customer-groups";
import { PageHeader } from "@/components/ui";
import { GroupsClient } from "./GroupsClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerGroupsPage() {
  await requirePerm("contacts");
  const [access, o, groups] = await Promise.all([getAccess(), getOrg(), listCustomerGroupsWithCounts()]);
  const canManage = !!access && (access.isOwner || access.role === "admin");

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/contacts" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Contacts
        </Link>
      </div>
      <PageHeader
        title="Customer Groups"
        subtitle={
          o.customerGroupsEnabled
            ? "Segment customers (Wholesale, Retail, NGOs…) to break reports down by group. Every customer must belong to one. Nest a group inside another to create subgroups (e.g. an office with wholesale/retail subgroups)."
            : "Segment customers to break reports down by group. Currently optional — enable \"Require customer groups\" in Settings to make this mandatory."
        }
      />
      <GroupsClient groups={groups.map((g) => ({ id: g.id, name: g.name, parentGroupId: g.parentGroupId, memberCount: g.memberCount }))} canManage={canManage} />
    </>
  );
}
