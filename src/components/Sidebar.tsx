"use client";

import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { CreateMenu } from "./CreateMenu";
import {
  AnimatedSidebar,
  AnimatedSidebarClose,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarGroup,
  AnimatedSidebarGroupContent,
  AnimatedSidebarGroupLabel,
  AnimatedSidebarHeader,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarRail,
  AnimatedSidebarTrigger,
} from "@/components/motion/animated-sidebar";

type ModuleKey = "crm" | "accounting" | "payroll";

const groups: {
  label: string | null;
  items: { href: string; label: string; icon: string; perm: string; module?: ModuleKey }[];
}[] = [
  {
    label: null,
    items: [
      { href: "/home", label: "Home", icon: "🏠", perm: "dashboard" },
      { href: "/announcements", label: "Announcements", icon: "📣", perm: "announcements" },
      { href: "/time-tracking", label: "Time Tracking", icon: "⏱️", perm: "dashboard" },
      { href: "/leave-requests", label: "Leave Requests", icon: "🌴", perm: "leave_requests" },
    ],
  },
  {
    label: "Selling",
    items: [
      { href: "/contacts", label: "Customers & Vendors", icon: "👥", perm: "contacts", module: "crm" },
      { href: "/campaigns", label: "Campaigns", icon: "📣", perm: "campaigns", module: "crm" },
      { href: "/pipeline", label: "Deals", icon: "🎯", perm: "pipeline", module: "crm" },
      { href: "/sales/quotes", label: "Quotes", icon: "📝", perm: "quotes", module: "crm" },
      { href: "/sales/quote-templates", label: "Quote Templates", icon: "🗒️", perm: "quote_templates", module: "crm" },
      { href: "/sales/invoices", label: "Invoices", icon: "🧾", perm: "invoices", module: "crm" },
      { href: "/sales/invoice-templates", label: "Invoice Templates", icon: "🗂️", perm: "invoice_templates", module: "crm" },
      { href: "/sales/payments", label: "Payments Received", icon: "💰", perm: "invoices", module: "crm" },
      { href: "/sales/credit-notes", label: "Credit Notes", icon: "↩️", perm: "credit_notes", module: "crm" },
    ],
  },
  {
    label: "Spending",
    items: [
      { href: "/purchases/expenses", label: "Expenses", icon: "💸", perm: "expenses", module: "accounting" },
      { href: "/expense-claims", label: "Expense Claims", icon: "🧾", perm: "expense_claims" },
      { href: "/purchases/bills", label: "Bills", icon: "📄", perm: "bills", module: "accounting" },
      { href: "/purchases/orders", label: "Purchase Orders", icon: "📦", perm: "purchase_orders", module: "accounting" },
      { href: "/purchases/payment-runs", label: "Payment Runs", icon: "🏃", perm: "bills", module: "accounting" },
      { href: "/purchases/payouts", label: "Stuck Payouts", icon: "⚠️", perm: "can_payout", module: "accounting" },
      { href: "/items", label: "Items & Stock", icon: "📦", perm: "items", module: "crm" },
      { href: "/items/warehouses", label: "Warehouses", icon: "🏬", perm: "items", module: "crm" },
      { href: "/items/transfers", label: "Stock Transfers", icon: "🔄", perm: "items", module: "crm" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/banking", label: "Bank & M-Pesa", icon: "🏦", perm: "banking", module: "accounting" },
      { href: "/accountant", label: "Accountant", icon: "📚", perm: "accountant", module: "accounting" },
      { href: "/accounting/assets", label: "Fixed Assets", icon: "🏢", perm: "fixed_assets", module: "accounting" },
      { href: "/analytics", label: "Analytics", icon: "📊", perm: "reports", module: "accounting" },
      { href: "/reports", label: "Reports", icon: "📈", perm: "reports", module: "accounting" },
    ],
  },
  {
    label: "Payroll",
    items: [
      { href: "/payroll/runs", label: "Payroll Runs", icon: "💵", perm: "payroll", module: "payroll" },
      { href: "/payroll/employees", label: "Employees", icon: "🧑‍💼", perm: "payroll", module: "payroll" },
      { href: "/payroll/rules", label: "Rules & Tax", icon: "⚖️", perm: "payroll", module: "payroll" },
      { href: "/payroll/loans", label: "Loans", icon: "🏷️", perm: "payroll", module: "payroll" },
      { href: "/payroll/advances", label: "Salary Advances", icon: "💳", perm: "salary_advances", module: "payroll" },
    ],
  },
  {
    label: "Organization",
    items: [
      { href: "/staff", label: "Staff & Roles", icon: "🛡️", perm: "staff" },
      { href: "/recurring", label: "Recurring Templates", icon: "🔁", perm: "accountant", module: "accounting" },
      { href: "/settings/audit-logs", label: "Audit Logs", icon: "🕵️", perm: "__admin_only" },
      { href: "/settings", label: "Settings", icon: "⚙️", perm: "settings" },
      { href: "/settings/docs", label: "Documentation", icon: "📖", perm: "dashboard" },
      { href: "/settings/support", label: "Support", icon: "💬", perm: "dashboard" },
    ],
  },
];

interface SidebarProps {
  orgName?: string;
  orgEmail?: string;
  logoUrl?: string | null;
  /** module keys the current user may see; undefined = show all */
  perms?: string[];
  roleLabel?: string;
  timeTrackingEnabled?: boolean;
  /** Strictly owner/admin — audit logs are never role-toggleable, unlike every other module. */
  isAdmin?: boolean;
  /** Server-computed fallback (px) for before the client-measured banner
   *  stack height (--mobile-banner-offset, set by BannerStack) kicks in —
   *  only knows about the super-admin announcement, since team announcements'
   *  visible count depends on client-side dismiss state. */
  topOffsetPx?: number;
  /** Which of the org's paid modules to show — admin-toggled on the org detail
   *  page (org.crmEnabled/accountingEnabled/payrollEnabled). This is UI
   *  visibility only: everything keeps posting/calculating in the background
   *  regardless, a disabled module's links just don't render here. Undefined
   *  = show everything (matches every existing org's default of all-true). */
  crmEnabled?: boolean;
  accountingEnabled?: boolean;
  payrollEnabled?: boolean;
}

/**
 * Must render inside a PersistentSidebarProvider (see (app)/layout.tsx) —
 * the provider owns collapsed/expanded state so the desktop rail, the mobile
 * drawer and the mobile top pill all share it.
 */
export function Sidebar({ orgName, orgEmail, logoUrl, perms, roleLabel, timeTrackingEnabled, isAdmin, topOffsetPx = 0, crmEnabled = true, accountingEnabled = true, payrollEnabled = true }: SidebarProps) {
  const pathname = usePathname();

  const moduleOn: Record<ModuleKey, boolean> = { crm: crmEnabled, accounting: accountingEnabled, payroll: payrollEnabled };
  const allowed = perms ? new Set(perms) : null;
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (it.href === "/time-tracking" && !timeTrackingEnabled) return false;
        if (it.perm === "__admin_only") return !!isAdmin;
        if (it.module && !moduleOn[it.module]) return false;
        return !allowed || allowed.has(it.perm);
      }),
    }))
    .filter((g) => g.items.length > 0);

  // One active item at a time (the longest matching href) — a plain
  // startsWith lights up parent and child routes together (/items and
  // /items/warehouses), which would make the shared sliding pill jump
  // between two targets.
  const activeHref = visibleGroups
    .flatMap((g) => g.items)
    .filter((it) => pathname.startsWith(it.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const displayName = orgName || "My Business";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Mobile top bar — floating pill: menu trigger left, org name + role centered */}
      <div
        className="md:hidden no-print fixed inset-x-0 z-40 px-3 pt-3"
        style={{ top: `var(--mobile-banner-offset, ${topOffsetPx}px)` }}
      >
        <div className="relative sidebar-chrome rounded-[32px] shadow-[0_2px_14px_rgba(0,0,0,0.08)] border border-[var(--color-ink-100)]/70 h-16 flex items-center justify-center">
          <AnimatedSidebarTrigger
            aria-label="Open menu"
            className="absolute left-2.5 size-10 rounded-full text-[var(--color-ink-900)] hover:bg-white/60"
          >
            <PanelLeft aria-hidden="true" className="size-5" />
          </AnimatedSidebarTrigger>
          <div className="flex flex-col items-center leading-tight max-w-[55vw]">
            <span className="text-[14px] font-semibold tracking-tight truncate">{displayName}</span>
            {roleLabel && <span className="text-[11px] text-[var(--color-ink-400)] mt-0.5 truncate">{roleLabel}</span>}
          </div>
        </div>
      </div>

      <AnimatedSidebar
        ariaLabel="Main navigation"
        collapsible="icon"
        className="no-print"
        panelClassName="bg-[rgba(245,245,247,0.85)] backdrop-blur-[20px] backdrop-saturate-[1.4] border-[var(--color-ink-100)]"
      >
        <AnimatedSidebarHeader className="px-4 pt-5 pb-3 group-data-[state=collapsed]/sidebar:px-3">
          <div className="flex items-center gap-2.5 group-data-[state=collapsed]/sidebar:flex-col">
            <div
              className={`shrink-0 w-14 h-14 group-data-[state=collapsed]/sidebar:size-11 rounded-xl overflow-hidden flex items-center justify-center ${
                logoUrl ? "" : "bg-[var(--color-accent-500)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              }`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={displayName} width={56} height={56} className="object-contain w-full h-full" />
              ) : (
                <span className="text-white text-[18px] font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
              <div className="text-[13.5px] font-semibold tracking-tight truncate leading-tight">{displayName}</div>
              <div className="text-[10.5px] text-[var(--color-ink-400)] mt-0.5 truncate">
                {roleLabel ? `${roleLabel} · ` : ""}Powered by Zeno
              </div>
            </div>
            <AnimatedSidebarTrigger
              aria-label="Toggle sidebar (Ctrl/⌘ B)"
              title="Toggle sidebar (Ctrl/⌘ B)"
              className="hidden md:inline-flex size-8 rounded-lg text-[var(--color-ink-400)] hover:bg-white/60 hover:text-[var(--color-ink-800)]"
            >
              <PanelLeft aria-hidden="true" className="size-4" />
            </AnimatedSidebarTrigger>
            <AnimatedSidebarClose className="ml-auto size-8 text-[18px] text-[var(--color-ink-600)] hover:bg-white/70 md:hidden">
              ×
            </AnimatedSidebarClose>
          </div>
        </AnimatedSidebarHeader>

        {(!allowed || allowed.has("invoices")) && (
          <div className="px-3 pb-3 group-data-[state=collapsed]/sidebar:hidden">
            <CreateMenu />
          </div>
        )}

        <AnimatedSidebarContent className="px-3 py-2">
          {visibleGroups.map((g, gi) => (
            <AnimatedSidebarGroup key={gi} className="px-0 py-1">
              {g.label && <AnimatedSidebarGroupLabel className="h-6 text-[10.5px] font-semibold tracking-wider">{g.label}</AnimatedSidebarGroupLabel>}
              <AnimatedSidebarGroupContent>
                <AnimatedSidebarMenu>
                  {g.items.map((it) => (
                    <AnimatedSidebarMenuItem key={it.href}>
                      <AnimatedSidebarMenuButton
                        href={it.href}
                        isActive={it.href === activeHref}
                        icon={<span className="text-[14px] leading-none opacity-80">{it.icon}</span>}
                        className={`min-h-[34px] rounded-md text-[13px] ${
                          it.href === activeHref ? "text-[var(--color-accent-700)]" : "text-[var(--color-ink-600)]"
                        }`}
                      >
                        {it.label}
                      </AnimatedSidebarMenuButton>
                    </AnimatedSidebarMenuItem>
                  ))}
                </AnimatedSidebarMenu>
              </AnimatedSidebarGroupContent>
            </AnimatedSidebarGroup>
          ))}
        </AnimatedSidebarContent>

        <AnimatedSidebarFooter className="hairline-t border-t-0 px-4 py-3 group-data-[state=collapsed]/sidebar:px-1">
          <div className="flex items-center justify-between group-data-[state=collapsed]/sidebar:justify-center">
            <div className="min-w-0 group-data-[state=collapsed]/sidebar:hidden">
              <div className="text-[11.5px] text-[var(--color-ink-600)] truncate">{orgEmail || ""}</div>
            </div>
            <SignOutButton />
          </div>
        </AnimatedSidebarFooter>

        <AnimatedSidebarRail />
      </AnimatedSidebar>
    </>
  );
}
