import { requirePerm } from "@/lib/guard";
import { db, itemTypes } from "@/db";
import { eq, asc } from "drizzle-orm";
import { currentOrgId } from "@/lib/org";
import { PageHeader } from "@/components/ui";
import Link from "next/link";
import { ItemTypesClient } from "./ItemTypesClient";

export const dynamic = "force-dynamic";

export default async function ItemTypesPage() {
  await requirePerm("items");
  const orgId = currentOrgId();

  const types = await db
    .select()
    .from(itemTypes)
    .where(eq(itemTypes.orgId, orgId))
    .orderBy(asc(itemTypes.id));

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/items" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Items
        </Link>
      </div>
      <PageHeader title="Item Types" subtitle="Manage item types and configure whether they require an item group." />
      <div className="card max-w-3xl overflow-hidden mt-6">
        <ItemTypesClient types={types} />
      </div>
    </>
  );
}
