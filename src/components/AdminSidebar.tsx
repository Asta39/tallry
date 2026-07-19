"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

const groups = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Overview", icon: "◧" },
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
    ],
  },
  {
    label: "Billing & Logs",
    items: [
      { href: "/admin/revenue", label: "Revenue", icon: "📈" },
      { href: "/admin/payments", label: "M-Pesa Logs", icon: "💸" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: "💳" },
      { href: "/admin/audit", label: "Audit Log", icon: "📜" },
    ],
  },
];

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const nav = (
    <>
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center bg-red-600 shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <span className="text-white text-[18px] font-bold">SA</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-tight truncate leading-tight">Super Admin</div>
            <div className="text-[10.5px] text-[var(--color-ink-400)] mt-0.5">Tallry Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && (
              <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                {g.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] transition-colors ${
                      active(it.href)
                        ? "bg-white/80 text-red-700 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        : "text-[var(--color-ink-600)] hover:bg-white/50"
                    }`}
                  >
                    <span className="w-4 text-center opacity-70">{it.icon}</span>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hairline-t px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11.5px] text-[var(--color-ink-600)] truncate">{userEmail}</div>
        </div>
        <SignOutButton />
      </div>
    </>
  );

  return (
    <>
      <div className="md:hidden no-print fixed top-0 inset-x-0 z-40 sidebar-chrome border-b border-[var(--color-ink-100)] flex items-center gap-3 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-white/60"
        >
          <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
          <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
          <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
        </button>
        <span className="text-[14px] font-semibold tracking-tight truncate">Super Admin</span>
      </div>

      {open && (
        <div className="md:hidden no-print fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[270px] max-w-[85vw] bg-[var(--color-ink-50)] flex flex-col shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 rounded-full hover:bg-white/70 text-[18px] text-[var(--color-ink-600)]"
            >
              ×
            </button>
            {nav}
          </aside>
        </div>
      )}

      <aside className="hidden md:flex sidebar-chrome no-print w-[230px] shrink-0 sticky top-0 h-screen flex-col border-r border-[var(--color-ink-100)]">
        {nav}
      </aside>
    </>
  );
}
