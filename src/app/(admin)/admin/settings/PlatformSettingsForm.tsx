"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlatformSettingsAction } from "@/lib/platform-settings";

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

export function PlatformSettingsForm({
  trialDays,
  perStaffFeeKes,
  platformOrgId,
  orgs,
  updatedAt,
  updatedByEmail,
}: {
  trialDays: number;
  perStaffFeeKes: number;
  platformOrgId: number | null;
  orgs: { id: number; name: string }[];
  updatedAt: string;
  updatedByEmail: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState(String(trialDays));
  const [fee, setFee] = useState(String(perStaffFeeKes));
  const [orgId, setOrgId] = useState(platformOrgId ? String(platformOrgId) : "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    const daysNum = Number(days);
    const feeNum = Number(fee);
    if (!Number.isInteger(daysNum) || daysNum < 1) return setError("Trial days must be a positive whole number");
    if (!Number.isFinite(feeNum) || feeNum < 0) return setError("Per-seat fee must be a non-negative amount");
    start(async () => {
      try {
        await updatePlatformSettingsAction({
          trialDays: daysNum,
          perStaffMonthlyFeeCents: Math.round(feeNum * 100),
          platformOrgId: orgId ? Number(orgId) : null,
        });
        setOk(true);
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not save settings");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={labelCls}>Free trial length (days)</span>
          <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className={inputCls + " mt-1"} />
          <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">Applies to every new signup going forward. Existing trials keep their original end date.</span>
        </label>
        <label className="block">
          <span className={labelCls}>Per-seat monthly fee (KSh)</span>
          <input type="number" min={0} step="1" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls + " mt-1"} />
          <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">Billed per active staff member + owner. Feeds every "Recalc" and auto-sync going forward — doesn't retroactively change an org's already-set fee.</span>
        </label>
      </div>

      <div>
        <label className="block">
          <span className={labelCls}>Platform operator org</span>
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputCls + " mt-1"}>
            <option value="">Off — no auto-invoicing</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name || `Org #${o.id}`}</option>
            ))}
          </select>
          <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">
            The org that auto-invoices every other active client for their maintenance fee (via a matching Contact + recurring template inside its own books). Changing this only affects orgs activated/reinstated after the change — it never moves already-linked clients.
          </span>
        </label>
      </div>

      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      {ok && !pending && <p className="text-[12.5px] text-[var(--color-good)]">Saved.</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        {updatedByEmail && (
          <span className="text-[11.5px] text-[var(--color-ink-400)]">
            Last changed by {updatedByEmail} · {updatedAt.slice(0, 16).replace("T", " ")}
          </span>
        )}
      </div>
    </form>
  );
}
