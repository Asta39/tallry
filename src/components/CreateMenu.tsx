"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = [
    { label: "Invoice", href: "/sales/invoices/new" },
    { label: "Quote", href: "/sales/quotes/new" },
    { label: "Expense", href: "/purchases/expenses/new" },
    { label: "Bill", href: "/purchases/bills/new" },
    { label: "Purchase Order", href: "/purchases/orders/new" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-full rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium py-2 transition-colors"
      >
        + Create
      </button>

      {open && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-[var(--color-ink-100)] py-1.5 z-50 overflow-hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-[13px] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-accent-700)] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
