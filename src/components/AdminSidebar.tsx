"use client";

import { PanelLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";
import { AdminGlobalSearch } from "./AdminGlobalSearch";
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

const groups = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Overview", icon: "◧" },
      { href: "/admin/analytics", label: "Analytics", icon: "📊" },
      { href: "/admin/health", label: "Health", icon: "🩺" },
      { href: "/admin/funnel", label: "Activation", icon: "🔻" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/orgs", label: "Organizations", icon: "🏢" },
      { href: "/admin/users", label: "Users", icon: "👥" },
      { href: "/admin/team", label: "Super Admins", icon: "🛡️" },
      { href: "/admin/settings", label: "Settings", icon: "⚙️" },
    ],
  },
  {
    label: "Billing & Logs",
    items: [
      { href: "/admin/revenue", label: "Revenue", icon: "📈" },
      { href: "/admin/billing-payments", label: "Billing Payments", icon: "🧾" },
      { href: "/admin/purchase-requests", label: "Purchase Requests", icon: "🛒" },
      { href: "/admin/payments", label: "M-Pesa Logs", icon: "💸" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: "💳" },
      { href: "/admin/cron", label: "Scheduled Jobs", icon: "⏱" },
      { href: "/admin/ledger-integrity", label: "Ledger Integrity", icon: "⚖️" },
      { href: "/admin/backups", label: "Org Backups", icon: "🗄️" },
      { href: "/admin/audit", label: "Audit Log", icon: "📜" },
    ],
  },
];

/** Must render inside a PersistentSidebarProvider (see (admin)/layout.tsx). */
export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  // "/admin" only matches itself; every other item matches by prefix, and the
  // longest match wins so the shared sliding pill has a single target.
  const activeHref = groups
    .flatMap((g) => g.items)
    .filter((it) => (it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      <div className="md:hidden no-print fixed top-0 inset-x-0 z-40 px-3 pt-3">
        <div className="relative sidebar-chrome rounded-[32px] shadow-[0_2px_14px_rgba(0,0,0,0.08)] border border-[var(--color-ink-100)]/70 h-16 flex items-center justify-center">
          <AnimatedSidebarTrigger
            aria-label="Open menu"
            className="absolute left-2.5 size-10 rounded-full text-[var(--color-ink-900)] hover:bg-white/60"
          >
            <PanelLeft aria-hidden="true" className="size-5" />
          </AnimatedSidebarTrigger>
          <div className="flex flex-col items-center leading-tight max-w-[55vw]">
            <span className="text-[14px] font-semibold tracking-tight truncate">Zeno Platform</span>
            <span className="text-[11px] text-[var(--color-ink-400)] mt-0.5 truncate">Super Admin</span>
          </div>
        </div>
      </div>

      <AnimatedSidebar
        ariaLabel="Admin navigation"
        collapsible="icon"
        className="no-print"
        panelClassName="bg-[rgba(245,245,247,0.85)] backdrop-blur-[20px] backdrop-saturate-[1.4] border-[var(--color-ink-100)]"
      >
        <AnimatedSidebarHeader className="px-4 pt-5 pb-3 group-data-[state=collapsed]/sidebar:px-3">
          <div className="flex items-center gap-2.5 group-data-[state=collapsed]/sidebar:flex-col">
            <div className="shrink-0 w-14 h-14 group-data-[state=collapsed]/sidebar:size-11 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] border border-[var(--color-ink-100)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/admin-logo.jpg" alt="Zeno" width={56} height={56} className="object-contain w-full h-full" />
            </div>
            <div className="min-w-0 flex-1 group-data-[state=collapsed]/sidebar:hidden">
              <div className="text-[13.5px] font-semibold tracking-tight truncate leading-tight">Super Admin</div>
              <div className="text-[10.5px] text-[var(--color-ink-400)] mt-0.5">Zeno Platform</div>
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
          <div className="mt-3 group-data-[state=collapsed]/sidebar:hidden">
            <AdminGlobalSearch />
          </div>
        </AnimatedSidebarHeader>

        <AnimatedSidebarContent className="px-3 py-2">
          {groups.map((g, gi) => (
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
                          it.href === activeHref ? "text-red-700" : "text-[var(--color-ink-600)]"
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
              <div className="text-[11.5px] text-[var(--color-ink-600)] truncate">{userEmail}</div>
            </div>
            <SignOutButton />
          </div>
        </AnimatedSidebarFooter>

        <AnimatedSidebarRail />
      </AnimatedSidebar>
    </>
  );
}
