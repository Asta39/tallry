import Link from "next/link";

/**
 * Per-tile plan gate for the analytics screen. Unlike the full-page
 * UpgradePrompt, several cards on this one screen can be locked while
 * neighbors stay usable — so the blur + upsell chip is scoped to the card.
 * Locked tiles never receive real data from the server (see AnalyticsCard).
 */
export function LockedCard({
  locked,
  planLabel,
  children,
}: {
  locked: boolean;
  planLabel: string;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="blur-[3px] opacity-40 pointer-events-none select-none" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Link
          href="/settings/billing"
          className="flex items-center gap-2 rounded-full bg-white/95 border border-[var(--color-ink-200)] shadow-sm px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-ink-700)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {planLabel} plan
        </Link>
      </div>
    </div>
  );
}
