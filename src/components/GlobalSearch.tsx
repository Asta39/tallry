"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

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
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.results) {
            setResults(data.results);
            setOpen(true);
          }
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative w-full max-w-md mx-auto sm:mx-0 sm:ml-auto md:ml-0 md:mr-auto" ref={ref}>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-[16px] opacity-40">⌕</span>
        <input
          type="text"
          placeholder="Search customers, vendors, invoices..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="w-full h-9 pl-9 pr-4 rounded-full bg-[var(--color-ink-50)] border border-[var(--color-ink-200)] text-[13px] outline-none focus:bg-white focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all placeholder:text-[var(--color-ink-400)]"
        />
        {loading && (
          <span className="absolute right-3 w-4 h-4 rounded-full border-2 border-t-[var(--color-accent-500)] border-r-[var(--color-accent-500)] border-b-transparent border-l-transparent animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-[var(--color-ink-100)] py-1.5 z-50 overflow-hidden">
          {results.map((r, i) => (
            <Link
              key={i}
              href={r.href}
              className="flex flex-col px-4 py-2 hover:bg-[var(--color-ink-50)] transition-colors"
            >
              <div className="text-[13px] font-medium text-[var(--color-ink-900)] truncate">
                {r.title}
              </div>
              <div className="text-[11px] text-[var(--color-ink-400)] truncate mt-0.5">
                {r.subtitle}
              </div>
            </Link>
          ))}
        </div>
      )}
      
      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-[var(--color-ink-100)] p-4 text-center text-[12.5px] text-[var(--color-ink-500)] z-50">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
