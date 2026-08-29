import { getAccessCached } from "@/lib/access";

const MODULE_LABELS = { crm: "CRM", accounting: "Accounting", payroll: "Payroll" } as const;

/**
 * Server-side gate for a whole route segment (used from that segment's own
 * layout.tsx, e.g. app/(app)/payroll/layout.tsx) — blocks the page from
 * rendering, and therefore from running any of its own data-fetching, for
 * an org that hasn't paid for this module. This is deliberately separate
 * from the ledger/payroll engines themselves: server actions and background
 * jobs never pass through a page layout, so a disabled module keeps
 * posting/calculating exactly as before — this only stops the UI.
 */
export async function ModuleGuard({
  module,
  children,
}: {
  module: keyof typeof MODULE_LABELS;
  children: React.ReactNode;
}) {
  const access = await getAccessCached();
  const enabled =
    !access ||
    (module === "crm" ? access.orgRow.crmEnabled : module === "accounting" ? access.orgRow.accountingEnabled : access.orgRow.payrollEnabled);

  if (!enabled) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="text-[15px] font-semibold mb-2">{MODULE_LABELS[module]} isn't part of your plan</div>
          <p className="text-[13.5px] text-[var(--color-ink-500)]">
            Contact us if you'd like to add it — Settings → Support has our Call and WhatsApp details.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
