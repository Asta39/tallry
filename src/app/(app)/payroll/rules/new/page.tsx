import { requirePerm } from "@/lib/guard";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { createRuleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  await requirePerm("payroll");

  return (
    <>
      <PageHeader 
        title="Add Statutory Rule" 
        subtitle="Create a new tax bracket, deduction, or statutory contribution rule"
      />
      <div className="card max-w-2xl mt-6">
        <form action={createRuleAction} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Rule Type</label>
              <select name="type" required className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]">
                <option value="PAYE">PAYE (Income Tax)</option>
                <option value="SHIF">SHIF (Health Insurance)</option>
                <option value="NSSF_1">NSSF Tier 1</option>
                <option value="NSSF_2">NSSF Tier 2</option>
                <option value="AHL">Affordable Housing Levy</option>
                <option value="RELIEF">Personal Relief</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Calculation Type</label>
              <select name="calculationType" required className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]">
                <option value="banded">Banded (e.g., Tax Brackets)</option>
                <option value="flat_percent">Flat Percentage</option>
                <option value="flat_amount">Flat Amount</option>
                <option value="capped">Capped Amount/Percentage</option>
              </select>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Effective From</label>
              <input name="effectiveFrom" type="date" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required />
            </div>

            <div className="col-span-2">
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Parameters (JSON Format)</label>
              <textarea name="parametersJson" rows={4} className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] font-mono text-[11px]" required placeholder='{"rate": 0.16, "cap": null}' defaultValue='{}'></textarea>
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Specify brackets, caps, or flat amounts here. Example: <code>{`{"rate": 0.0275}`}</code> for SHIF.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <PrimaryButton type="submit">Add Rule</PrimaryButton>
          </div>
        </form>
      </div>
    </>
  );
}
