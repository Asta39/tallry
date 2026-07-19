"use client";

import { useState, useTransition } from "react";
import { toggleFeatureFlagAction } from "../../actions";

const FEATURES: { flag: string; label: string }[] = [
  { flag: "gateways", label: "Payment gateways" },
  { flag: "sms", label: "SMS receipts" },
  { flag: "payouts", label: "Payouts" },
  { flag: "portal", label: "Customer portal" },
  { flag: "recurring", label: "Recurring documents" },
  { flag: "payroll", label: "Payroll" },
];

export function FeatureFlagToggles({ orgId, planFeatures, overrides }: {
  orgId: number;
  /** features already included in the org's plan */
  planFeatures: string[];
  /** flags currently force-enabled */
  overrides: string[];
}) {
  const [flags, setFlags] = useState(new Set(overrides));
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <ul className="divide-y divide-[var(--color-ink-100)]">
      {FEATURES.map((f) => {
        const inPlan = planFeatures.includes(f.flag);
        const overridden = flags.has(f.flag);
        return (
          <li key={f.flag} className="py-2 flex items-center justify-between gap-3 text-[13px]">
            <div>
              <span className="font-medium">{f.label}</span>
              {inPlan && <span className="ml-2 text-[10.5px] text-[var(--color-ink-400)]">in plan</span>}
              {!inPlan && overridden && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">override</span>}
            </div>
            {inPlan ? (
              <span className="text-[11.5px] text-[var(--color-good)]">✓ enabled</span>
            ) : (
              <button
                disabled={pendingFlag === f.flag}
                onClick={() => {
                  setPendingFlag(f.flag);
                  startTransition(async () => {
                    const res = await toggleFeatureFlagAction(orgId, f.flag);
                    if (res && "enabled" in res) {
                      setFlags((prev) => {
                        const next = new Set(prev);
                        if (res.enabled) next.add(f.flag);
                        else next.delete(f.flag);
                        return next;
                      });
                    }
                    setPendingFlag(null);
                  });
                }}
                className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${overridden ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-ink-200)]"}`}
                aria-label={`${overridden ? "Revoke" : "Grant"} ${f.label}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${overridden ? "left-[18px]" : "left-0.5"}`} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
