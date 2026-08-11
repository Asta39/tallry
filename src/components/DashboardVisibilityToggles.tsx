"use client";

import { useState, useTransition } from "react";
import { setDashboardVisibilityAction } from "@/lib/actions";

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-ink-200)]"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function DashboardVisibilityToggles({
  showCollectedThisYearCard,
  showInvoiceCollectionTotals,
}: {
  showCollectedThisYearCard: boolean;
  showInvoiceCollectionTotals: boolean;
}) {
  const [collected, setCollected] = useState(showCollectedThisYearCard);
  const [totals, setTotals] = useState(showInvoiceCollectionTotals);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: { showCollectedThisYearCard?: boolean; showInvoiceCollectionTotals?: boolean }) {
    setError(null);
    start(async () => {
      try {
        await setDashboardVisibilityAction(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
        if (next.showCollectedThisYearCard !== undefined) setCollected(!next.showCollectedThisYearCard);
        if (next.showInvoiceCollectionTotals !== undefined) setTotals(!next.showInvoiceCollectionTotals);
      }
    });
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium">&quot;Collected this year&quot; card</div>
          <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5">
            Shown on staff&apos;s home dashboard, summarizing payments on their assigned invoices this year.
          </div>
        </div>
        <Toggle
          checked={collected}
          disabled={pending}
          onChange={(v) => {
            setCollected(v);
            update({ showCollectedThisYearCard: v });
          }}
        />
      </div>

      <div className="hairline-t pt-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium">Invoice collection totals</div>
          <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5">
            The yearly outstanding / past due / paid invoice totals (including the annual total) shown under the
            invoice &amp; quote overview on the home dashboard, for staff who can otherwise see org-wide data.
          </div>
        </div>
        <Toggle
          checked={totals}
          disabled={pending}
          onChange={(v) => {
            setTotals(v);
            update({ showInvoiceCollectionTotals: v });
          }}
        />
      </div>

      {error && <div className="text-[12.5px] text-[var(--color-bad)]">{error}</div>}
    </div>
  );
}
