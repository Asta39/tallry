import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/guard";
import { saveItem } from "@/lib/actions";
import { parseKES } from "@/lib/money";
import { TAX_CLASSES } from "@/lib/tax";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

export default async function NewItemPage() {
  await requirePerm("items");
  async function create(formData: FormData) {
    "use server";
    await saveItem({
      kind: String(formData.get("kind") || "service"),
      name: String(formData.get("name") || "").trim(),
      sku: String(formData.get("sku") || "") || undefined,
      unit: String(formData.get("unit") || "unit"),
      salePriceCents: parseKES(String(formData.get("salePrice") || "0")) || 0,
      purchaseCostCents: parseKES(String(formData.get("purchaseCost") || "0")) || 0,
      taxClass: String(formData.get("taxClass") || "B16"),
      trackInventory: formData.get("trackInventory") === "on",
      reorderLevel: Number(formData.get("reorderLevel") || 0),
      openingQty: Number(formData.get("openingQty") || 0),
      openingUnitCostCents: parseKES(String(formData.get("openingCost") || "0")) || 0,
    });
    redirect("/items");
  }

  return (
    <>
      <PageHeader title="New item" />
      <form action={create} className="card p-6 max-w-2xl grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>Type</span>
          <select name="kind" className={input}>
            <option value="service">Service</option>
            <option value="goods">Goods (physical product)</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Name *</span>
          <input name="name" required className={input} />
        </label>
        <label className="block">
          <span className={label}>SKU / code</span>
          <input name="sku" className={input} />
        </label>
        <label className="block">
          <span className={label}>Unit</span>
          <input name="unit" defaultValue="unit" className={input} placeholder="pc, kg, hour…" />
        </label>
        <label className="block">
          <span className={label}>Selling price (KSh)</span>
          <input name="salePrice" className={input} placeholder="0.00" />
        </label>
        <label className="block">
          <span className={label}>Buying cost (KSh)</span>
          <input name="purchaseCost" className={input} placeholder="0.00" />
        </label>
        <label className="block col-span-2">
          <span className={label}>VAT treatment</span>
          <select name="taxClass" className={input}>
            {Object.entries(TAX_CLASSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <div className="col-span-2 hairline-t pt-4">
          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" name="trackInventory" className="accent-[var(--color-accent-500)]" />
            Track stock for this item (FIFO costing)
          </label>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <label className="block">
              <span className={label}>Opening stock (qty)</span>
              <input name="openingQty" className={input} placeholder="0" />
            </label>
            <label className="block">
              <span className={label}>Opening cost / unit (KSh)</span>
              <input name="openingCost" className={input} placeholder="0.00" />
            </label>
            <label className="block">
              <span className={label}>Reorder alert at</span>
              <input name="reorderLevel" className={input} placeholder="10" />
            </label>
          </div>
        </div>
        <div className="col-span-2 flex gap-3 pt-1">
          <button className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5">
            Save item
          </button>
          <a href="/items" className="text-[13px] text-[var(--color-ink-400)] self-center">Cancel</a>
        </div>
      </form>
    </>
  );
}
