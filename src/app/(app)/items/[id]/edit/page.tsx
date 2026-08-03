import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, asc } from "drizzle-orm";
import { db, items, itemTypes } from "@/db";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { saveItem } from "@/lib/actions";
import { parseKES } from "@/lib/money";
import { TAX_CLASSES } from "@/lib/tax";
import { listItemGroups } from "@/lib/item-groups";
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
  const [item, groups, orgTypes] = await Promise.all([
    db.select().from(items).where(and(eq(items.orgId, o.id), eq(items.id, itemId))).limit(1),
    listItemGroups(),
    db.select().from(itemTypes).where(eq(itemTypes.orgId, o.id)).orderBy(asc(itemTypes.id)),
  ]);
  const row = item[0];
  if (!row) notFound();

  const groupsRequired = o.itemGroupsEnabled;
  const blockedForMissingGroups = groupsRequired && groups.length === 0;
  const typeMandatoryMap = Object.fromEntries(orgTypes.map((t) => [t.name, t.isGroupMandatory]));

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
      <form id="item-form" action={update} className="card p-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        {blockedForMissingGroups && (
          <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            Item groups are required for this organization, but none exist yet.{" "}
            <Link href="/items/groups" className="font-medium underline">
              Create an item group first
            </Link>
            .
          </div>
        )}
        <label className="block">
          <span className={label}>Type</span>
          <select id="kind-select" name="kind" className={input} defaultValue={row.kind}>
            {orgTypes.map(t => (
              <option key={t.id} value={t.name}>{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Name *</span>
          <input name="name" required defaultValue={row.name} className={input} />
        </label>
        <label className="block">
          <span className={label}>SKU / code</span>
          <input name="sku" defaultValue={row.sku ?? ""} className={input} />
        </label>
        <label className="block">
          <span id="item-group-label" className={label}>Item group {groupsRequired ? "*" : ""}</span>
          {groups.length > 0 ? (
            <select
              id="group-select"
              name="itemGroupId"
              className={input}
              required={groupsRequired}
              defaultValue={row.itemGroupId ? String(row.itemGroupId) : ""}
            >
              <option value="">{groupsRequired ? "Select a group" : "No group"}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          ) : (
            <div className="mt-1 rounded-lg border border-dashed border-[var(--color-ink-200)] px-3 py-2 text-[13px] text-[var(--color-ink-500)]">
              No item groups yet. <Link href="/items/groups" className="underline">Manage item groups</Link>.
            </div>
          )}
        </label>
        <label className="block">
          <span className={label}>Unit</span>
          <input name="unit" defaultValue={row.unit} className={input} placeholder="pc, kg, hour…" />
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
          <button
            disabled={blockedForMissingGroups}
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-5 py-2.5"
          >
            {blockedForMissingGroups ? "Create a group first" : "Save item"}
          </button>
          <a href="/items" className="text-[13px] text-[var(--color-ink-400)] self-center">Cancel</a>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              const kindSelect = document.getElementById('kind-select');
              const groupSelect = document.getElementById('group-select');
              const groupLabel = document.getElementById('item-group-label');
              
              if (kindSelect && groupSelect) {
                const typeMandatoryMap = ${JSON.stringify(typeMandatoryMap)};
                function updateGroup() {
                  const selectedKind = kindSelect.value;
                  const isMandatory = typeMandatoryMap[selectedKind] ?? true;
                  groupSelect.disabled = !isMandatory;
                  groupSelect.required = ${groupsRequired} && isMandatory;
                  if (groupLabel) {
                    groupLabel.innerText = 'Item group ' + (groupSelect.required ? '*' : '');
                  }
                }
                kindSelect.addEventListener('change', updateGroup);
                updateGroup();
              }
            `
          }}
        />
      </form>
    </>
  );
}
