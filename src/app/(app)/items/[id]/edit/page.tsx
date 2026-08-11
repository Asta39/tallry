import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, items } from "@/db";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { saveItem } from "@/lib/actions";
import { parseKES } from "@/lib/money";
import { TAX_CLASSES } from "@/lib/tax";
import { listItemGroups } from "@/lib/item-groups";
import { listItemTypes } from "@/lib/item-types";
import { ItemKindGroupFields } from "@/components/ItemKindGroupFields";
import { ItemBomEditor } from "@/components/ItemBomEditor";
import { listItemBom, listBomComponentOptions } from "@/lib/item-bom";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("items");
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) notFound();

  const o = await getOrg();
  const [item, groups, types] = await Promise.all([
    db.select().from(items).where(and(eq(items.orgId, o.id), eq(items.id, itemId))).limit(1),
    listItemGroups(),
    listItemTypes(),
  ]);
  const row = item[0];
  if (!row) notFound();

  const [bomRows, bomOptions] = o.bomEnabled
    ? await Promise.all([listItemBom(itemId), listBomComponentOptions(itemId)])
    : [[], []];

  const groupsRequired = o.itemGroupsEnabled;
  const noGroupsYetWarning = groupsRequired && groups.length === 0;
  // Defensive: an item's kind could predate the type that named it (legacy
  // data, or a type deleted out from under it — deletion is blocked while
  // in use, but this guards against any drift anyway) — keep it selectable
  // rather than silently swapping the item to whatever type sorts first.
  const typesForSelect = types.some((t) => t.name === row.kind)
    ? types
    : [...types, { id: -1, name: row.kind, isGroupMandatory: true, isSystem: false }];

  async function update(formData: FormData) {
    "use server";
    await saveItem({
      id: itemId,
      kind: String(formData.get("kind") || row.kind),
      itemGroupId: formData.get("itemGroupId") ? Number(formData.get("itemGroupId")) : null,
      name: String(formData.get("name") || "").trim(),
      sku: String(formData.get("sku") || "") || undefined,
      unit: String(formData.get("unit") || "unit"),
      description: String(formData.get("description") || "") || undefined,
      salePriceCents: parseKES(String(formData.get("salePrice") || "0")) || 0,
      purchaseCostCents: parseKES(String(formData.get("purchaseCost") || "0")) || 0,
      taxClass: String(formData.get("taxClass") || "B16"),
      trackInventory: formData.get("trackInventory") === "on",
      reorderLevel: Number(formData.get("reorderLevel") || 0),
      measurementType: (formData.get("measurementType") || null) as "length" | "area" | null,
    });
    redirect("/items");
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        <Link href="/items" className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]">
          &larr; Items
        </Link>
      </div>
      <PageHeader title={`Edit ${row.name}`} subtitle="Update item details and assign it to the right group." />
      <form action={update} className="card p-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        {noGroupsYetWarning && (
          <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            No item groups exist yet, and this org requires one for types that need it.{" "}
            <Link href="/items/groups" className="font-medium underline">
              Create an item group
            </Link>
            , or pick a type that doesn't require one.
          </div>
        )}
        <ItemKindGroupFields
          types={typesForSelect}
          groups={groups.map((g) => ({ id: g.id, name: g.name, appliesTo: g.appliesTo }))}
          orgGroupsEnabled={groupsRequired}
          defaultKind={row.kind}
          defaultGroupId={row.itemGroupId ?? ""}
        />
        <label className="block">
          <span className={label}>Name *</span>
          <input name="name" required defaultValue={row.name} className={input} />
        </label>
        <label className="block">
          <span className={label}>SKU / code</span>
          <input name="sku" defaultValue={row.sku ?? ""} className={input} />
        </label>
        <label className="block">
          <span className={label}>Unit</span>
          <input name="unit" defaultValue={row.unit} className={input} placeholder="pc, kg, hour…" />
        </label>
        <label className="block">
          <span className={label}>Measured by</span>
          <select name="measurementType" className={input} defaultValue={row.measurementType ?? ""}>
            <option value="">Plain count (default)</option>
            <option value="length">Length — one number, e.g. meters off a roll</option>
            <option value="area">Area — width × height entered separately</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Selling price (KSh)</span>
          <input name="salePrice" defaultValue={(row.salePriceCents / 100).toFixed(2)} className={input} />
        </label>
        <label className="block">
          <span className={label}>Buying cost (KSh)</span>
          <input name="purchaseCost" defaultValue={(row.purchaseCostCents / 100).toFixed(2)} className={input} />
        </label>
        <label className="block col-span-2">
          <span className={label}>Description</span>
          <textarea name="description" defaultValue={row.description ?? ""} className={input} rows={3} />
        </label>
        <label className="block col-span-2">
          <span className={label}>VAT treatment</span>
          <select name="taxClass" className={input} defaultValue={row.taxClass}>
            {Object.entries(TAX_CLASSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <div className="col-span-2 hairline-t pt-4">
          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input
              type="checkbox"
              name="trackInventory"
              defaultChecked={row.trackInventory}
              className="accent-[var(--color-accent-500)]"
            />
            Track stock for this item (FIFO costing)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <label className="block">
              <span className={label}>Reorder alert at</span>
              <input name="reorderLevel" defaultValue={row.reorderLevel} className={input} placeholder="10" />
            </label>
          </div>
        </div>
        <div className="col-span-2 flex gap-3 pt-1">
          <button className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-5 py-2.5">
            Save changes
          </button>
          <Link href="/items" className="text-[13px] text-[var(--color-ink-400)] self-center">Cancel</Link>
        </div>
      </form>

      {o.bomEnabled && (
        <div className="card p-6 max-w-2xl mt-5">
          <h2 className="text-[15px] font-semibold mb-1">Bill of Materials</h2>
          <ItemBomEditor parentItemId={itemId} parentName={row.name} options={bomOptions} initialRows={bomRows} />
        </div>
      )}
    </>
  );
}
