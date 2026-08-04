"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "dashboard", label: "Overview" },
  { href: "documents", label: "Invoices & Quotes" },
  { href: "deals", label: "Projects" },
  { href: "knowledge", label: "Help & Articles" },
];

export function PortalNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto min-w-0">
      {ITEMS.map((item) => {
        const href = `/portal/${orgSlug}/${item.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={item.href}
            href={href}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13.5px] font-medium whitespace-nowrap transition-colors ${
              active
                ? "bg-[var(--color-accent-500)] text-white shadow-sm"
                : "text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)] hover:bg-[var(--color-ink-100)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
