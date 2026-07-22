"use client";

import { useState } from "react";
import { createRuleAction, updateRuleAction } from "../actions";
import { PrimaryButton } from "@/components/ui";

export function RuleForm({ initialData }: { initialData?: any }) {
  const [calcType, setCalcType] = useState(initialData?.calculationType || "flat_percent");

  // Parse existing params safely
  let params: any = {};
  try {
    if (initialData?.parametersJson) {
      params = JSON.parse(initialData.parametersJson);
    }
  } catch (e) {}

  // State for simple flat rules
  const [rate, setRate] = useState(params.rate ? String(params.rate * 100) : "2.75");
  const [amount, setAmount] = useState(params.amountCents ? String(params.amountCents / 100) : "2400");
  const [cap, setCap] = useState(params.capCents ? String(params.capCents / 100) : "");
  const [minAmount, setMinAmount] = useState(params.minCents ? String(params.minCents / 100) : "");

  // State for banded-range rules (e.g. NSSF Tier II: a rate on the slice between two amounts)
  const [lower, setLower] = useState(params.lowerCents ? String(params.lowerCents / 100) : "8000");
  const [upper, setUpper] = useState(params.upperCents ? String(params.upperCents / 100) : "72000");

  // State for banded rules (PAYE) — 2023 Finance Act schedule, still current
  const defaultBands = params.bands ? params.bands.map((b: any) => ({
    upTo: b.upToCents ? String(b.upToCents / 100) : "",
    rate: String(b.rate * 100)
  })) : [
    { upTo: "24000", rate: "10" },
    { upTo: "8333", rate: "25" },
    { upTo: "467667", rate: "30" },
    { upTo: "300000", rate: "32.5" },
    { upTo: "", rate: "35" } // empty means infinite
  ];

  const [bands, setBands] = useState<{ upTo: string; rate: string }[]>(defaultBands);

  const minCents = minAmount ? Math.round(parseFloat(minAmount) * 100) : undefined;

  let parametersJson = "{}";
  try {
    if (calcType === "flat_percent") {
      parametersJson = JSON.stringify({ rate: parseFloat(rate) / 100, minCents });
    } else if (calcType === "flat_amount") {
      parametersJson = JSON.stringify({ amountCents: Math.round(parseFloat(amount) * 100) });
    } else if (calcType === "capped") {
      parametersJson = JSON.stringify({
        rate: parseFloat(rate) / 100,
        capCents: Math.round(parseFloat(cap) * 100),
        minCents
      });
    } else if (calcType === "banded_range") {
      parametersJson = JSON.stringify({
        lowerCents: Math.round(parseFloat(lower || "0") * 100),
        upperCents: upper ? Math.round(parseFloat(upper) * 100) : null,
        rate: parseFloat(rate) / 100,
        minCents
      });
    } else if (calcType === "banded") {
      parametersJson = JSON.stringify({
        bands: bands.map(b => ({
          upToCents: b.upTo ? Math.round(parseFloat(b.upTo) * 100) : null,
          rate: parseFloat(b.rate) / 100
        }))
      });
    }
  } catch (e) {
    // Ignore invalid float conversions while typing
  }

  function addBand() {
    setBands([...bands, { upTo: "", rate: "" }]);
  }

  function updateBand(index: number, field: "upTo" | "rate", value: string) {
    const newBands = [...bands];
    newBands[index][field] = value;
    setBands(newBands);
  }

  function removeBand(index: number) {
    setBands(bands.filter((_, i) => i !== index));
  }

  return (
    <form action={initialData ? updateRuleAction : createRuleAction} className="p-6 space-y-6">
      {initialData && <input type="hidden" name="id" value={initialData.id} />}
      <input type="hidden" name="parametersJson" value={parametersJson} />

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Rule Type</label>
          <select name="type" required defaultValue={initialData?.type || "PAYE"} className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]">
            <option value="PAYE">PAYE (Income Tax)</option>
            <option value="SHIF">SHIF (Health Insurance) — employee</option>
            <option value="NSSF_1">NSSF Tier 1 — employee</option>
            <option value="NSSF_2">NSSF Tier 2 — employee</option>
            <option value="AHL">Affordable Housing Levy — employee</option>
            <option value="RELIEF">Personal Relief</option>
            <option value="NSSF_1_EMPLOYER">NSSF Tier 1 — employer match</option>
            <option value="NSSF_2_EMPLOYER">NSSF Tier 2 — employer match</option>
            <option value="AHL_EMPLOYER">Affordable Housing Levy — employer</option>
            <option value="NITA">NITA Training Levy — employer</option>
          </select>
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
            "Employee" rules are deducted from pay. "Employer" rules and NITA are an extra business cost, not deducted from anyone's pay.
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Calculation Type</label>
          <select 
            name="calculationType" 
            required 
            value={calcType}
            onChange={e => setCalcType(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]"
          >
            <option value="flat_percent">Flat Percentage (e.g. SHIF, AHL)</option>
            <option value="banded_range">Percentage of a Band (e.g. NSSF Tier 1/2)</option>
            <option value="capped">Capped Percentage (legacy single-tier caps)</option>
            <option value="banded">Progressive Tax Brackets (PAYE)</option>
            <option value="flat_amount">Flat Fixed Amount (e.g. Personal Relief, NITA)</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Effective From</label>
          <input name="effectiveFrom" type="date" defaultValue={initialData?.effectiveFrom || ""} className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required />
        </div>
      </div>

      {/* Dynamic Settings UI */}
      <div className="col-span-2 p-4 bg-[var(--color-ink-50)] rounded-xl border border-[var(--color-ink-100)]">
        <h4 className="text-[13px] font-semibold text-[var(--color-ink-900)] mb-4">Rule Settings</h4>
        
        {calcType === "flat_percent" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Percentage Rate (%)</label>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required placeholder="e.g. 2.75" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">e.g. 2.75 for SHIF, 1.5 for AHL.</p>
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Minimum (KSh, optional)</label>
              <input type="number" step="0.01" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="e.g. 300 for SHIF's floor" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
              <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Won't deduct less than this even for very low earners.</p>
            </div>
          </div>
        )}

        {calcType === "banded_range" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Band Lower Bound (KSh)</label>
              <input type="number" step="0.01" value={lower} onChange={e => setLower(e.target.value)} required placeholder="e.g. 8000" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Band Upper Bound (KSh)</label>
              <input type="number" step="0.01" value={upper} onChange={e => setUpper(e.target.value)} placeholder="e.g. 72000, blank = no ceiling" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Percentage Rate (%)</label>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required placeholder="e.g. 6" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            </div>
            <p className="col-span-2 text-[11px] text-[var(--color-ink-400)]">
              The rate applies only to gross pay between the lower and upper bound — not to the whole salary. NSSF Tier 1: 0–8,000 at 6%. NSSF Tier 2: 8,000–72,000 at 6%.
            </p>
          </div>
        )}

        {calcType === "flat_amount" && (
          <div>
            <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Fixed Amount (KSh)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="e.g. 2400" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Enter the raw currency amount.</p>
          </div>
        )}

        {calcType === "capped" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Percentage Rate (%)</label>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(e.target.value)} required placeholder="e.g. 6" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            </div>
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Maximum Cap (KSh)</label>
              <input type="number" step="0.01" value={cap} onChange={e => setCap(e.target.value)} required placeholder="e.g. 3840" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" />
            </div>
            <p className="col-span-2 text-[11px] text-[var(--color-ink-400)]">A flat percentage of the whole gross, capped at a maximum. For NSSF use "Percentage of a Band" instead — NSSF's rate only applies within a band, not the whole salary.</p>
          </div>
        )}

        {calcType === "banded" && (
          <div className="space-y-3">
            <p className="text-[11px] text-[var(--color-ink-400)]">Define progressive tax brackets. Leave the "Up To" field empty for the final, infinite bracket.</p>
            <div className="space-y-2">
              {bands.map((b, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-[10px] text-[var(--color-ink-400)] mb-0.5">Up To (KSh)</label>
                    <input type="number" value={b.upTo} onChange={e => updateBand(index, 'upTo', e.target.value)} placeholder="e.g. 24000" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1 text-[12px] outline-none focus:border-[var(--color-accent-500)]" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-[var(--color-ink-400)] mb-0.5">Rate (%)</label>
                    <input type="number" step="0.1" value={b.rate} onChange={e => updateBand(index, 'rate', e.target.value)} required placeholder="e.g. 10" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1 text-[12px] outline-none focus:border-[var(--color-accent-500)]" />
                  </div>
                  <button type="button" onClick={() => removeBand(index)} className="mt-4 text-[var(--color-error-500)] hover:text-[var(--color-error-700)] px-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addBand} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline mt-2">
              + Add Tax Bracket
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-[var(--color-ink-100)]">
        <PrimaryButton type="submit">{initialData ? "Save Changes" : "Create Rule"}</PrimaryButton>
      </div>
    </form>
  );
}
