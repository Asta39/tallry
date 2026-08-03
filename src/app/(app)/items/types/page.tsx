import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { listItemTypes } from "@/lib/item-types";
import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { ItemTypesClient } from "./ItemTypesClient";

export const dynamic = "force-dynamic";

export default async function ItemTypesPage() {
  await requirePerm("items");
  const access = await getAccess();
  if (!access || !(access.isOwner || access.role === "admin")) redirect("/items");

  const types = await listItemTypes();

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/items" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Items
        </Link>
      </div>
      <PageHeader
        title="Item Types"
        subtitle="Goods and Service are built in. Add your own types (e.g. Unprocessed) and choose whether each one requires an item group."
      />
      <div className="card max-w-2xl overflow-hidden mt-6">
        <ItemTypesClient types={types} />
      </div>
    </>
  );
}
