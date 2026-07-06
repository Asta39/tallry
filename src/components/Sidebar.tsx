"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

const groups: { label: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: null,
    items: [{ href: "/", label: "Home", icon: "◧" }],
  },
  {
    label: "Selling",
    items: [
      { href: "/contacts", label: "Customers & Vendors", icon: "◉" },
      { href: "/pipeline", label: "Deals", icon: "▤" },
      { href: "/sales/quotes", label: "Quotes", icon: "✎" },
      { href: "/sales/invoices", label: "Invoices", icon: "▦" },
    ],
  },
  {
    label: "Spending",
    items: [
      { href: "/purchases/expenses", label: "Expenses", icon: "▨" },
      { href: "/purchases/bills", label: "Bills", icon: "▧" },
      { href: "/items", label: "Items & Stock", icon: "▣" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/banking", label: "Bank & M-Pesa", icon: "◫" },
      { href: "/accountant", label: "Accountant", icon: "≡" },
      { href: "/reports", label: "Reports", icon: "◪" },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", icon: "⚙" }],
  },
];

interface SidebarProps {
  orgName?: string;
  orgEmail?: string;
  logoUrl?: string | null;
}

export function Sidebar({ orgName, orgEmail, logoUrl }: SidebarProps) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const displayName = orgName || "My Business";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="sidebar-chrome no-print w-[230px] shrink-0 sticky top-0 h-screen flex flex-col border-r border-[var(--color-ink-100)]">
      {/* Business identity header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          {/* Logo or initials avatar */}
          <div className="shrink-0 w-9 h-9 rounded-xl overflow-hidden bg-[var(--color-accent-500)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={displayName}
                width={36}
                height={36}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-white text-[13px] font-bold">{initials}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-tight truncate leading-tight">
              {displayName}
            </div>
            <div className="text-[10.5px] text-[var(--color-ink-400)] mt-0.5">
              Powered by Tallry
            </div>
          </div>
        </div>
      </div>

      {/* New invoice CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/sales/invoices/new"
          className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium py-2 transition-colors"
        >
          + New Invoice
        </Link>
      </div>

      {/* Navigation */}
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
                        ? "bg-white/80 text-[var(--color-accent-700)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
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

      {/* User footer */}
      <div className="hairline-t px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11.5px] text-[var(--color-ink-600)] truncate">
            {orgEmail || ""}
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  );
}
