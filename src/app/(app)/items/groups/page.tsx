import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { getOrg } from "@/lib/org";
import { listItemGroupsWithCounts } from "@/lib/item-groups";
import { PageHeader } from "@/components/ui";
import { ItemGroupsClient } from "./ItemGroupsClient";

export const dynamic = "force-dynamic";

export default async function ItemGroupsPage() {
  await requirePerm("items");
  const access = await getAccess();
  const canManage = !!access && (access.isOwner || access.role === "admin");
  const o = await getOrg();
  const groups = await listItemGroupsWithCounts();

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/items" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Items
        </Link>
      </div>
      <PageHeader
        title="Item Groups"
        subtitle={
          o.itemGroupsEnabled
            ? "Organize inventory and services into groups. Every item must belong to one while the setting is enabled."
            : "Create item groups ahead of time, then enable the setting when you're ready to make them mandatory."
        }
      />
      <ItemGroupsClient
        groups={groups.map((g) => ({ id: g.id, name: g.name, itemCount: g.itemCount }))}
        canManage={canManage}
        enabled={o.itemGroupsEnabled}
      />
    </>
  );
}
