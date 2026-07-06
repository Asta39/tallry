import { redirect } from "next/navigation";
import { saveContact } from "@/lib/actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

export default function NewContactPage() {
  async function create(formData: FormData) {
    "use server";
    await saveContact({
      kind: String(formData.get("kind") || "customer"),
      displayName: String(formData.get("displayName") || "").trim(),
      companyName: String(formData.get("companyName") || "") || undefined,
      email: String(formData.get("email") || "") || undefined,
      phone: String(formData.get("phone") || "") || undefined,
      kraPin: String(formData.get("kraPin") || "") || undefined,
      address: String(formData.get("address") || "") || undefined,
      city: String(formData.get("city") || "") || undefined,
      isWithholdingAgent: formData.get("isWithholdingAgent") === "on",
    });
    redirect("/contacts");
  }

  return (
    <>
      <PageHeader title="New contact" />
      <form action={create} className="card p-6 max-w-2xl grid grid-cols-2 gap-4">
        <label className="block">
          <span className={label}>They are a…</span>
          <select name="kind" className={input}>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor / supplier</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className="block">
          <span className={label}>Name *</span>
          <input name="displayName" required className={input} placeholder="Jane Wanjiku / Acme Ltd" />
        </label>
        <label className="block">
          <span className={label}>Company</span>
          <input name="companyName" className={input} />
        </label>
        <label className="block">
          <span className={label}>KRA PIN</span>
          <input name="kraPin" className={input} placeholder="P0…" />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input name="phone" className={input} placeholder="+254 7…" />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <input name="email" type="email" className={input} />
        </label>
        <label className="block">
          <span className={label}>Address</span>
          <input name="address" className={input} />
        </label>
        <label className="block">
          <span className={label}>City</span>
          <input name="city" className={input} placeholder="Nairobi" />
        </label>
        <label className="flex items-center gap-2 col-span-2 text-[12.5px] text-[var(--color-ink-600)]">
          <input type="checkbox" name="isWithholdingAgent" className="accent-[var(--color-accent-500)]" />
          Appointed KRA withholding agent (they deduct 2% VAT / WHT when paying you)
        </label>
        <div className="col-span-2 flex gap-3 pt-1">
          <button className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5">
            Save contact
          </button>
          <a href="/contacts" className="text-[13px] text-[var(--color-ink-400)] self-center">Cancel</a>
        </div>
      </form>
    </>
  );
}
