"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

export function AdminGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
      fetch(`/api/admin-search?q=${encodeURIComponent(query)}`)
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
    <div className="relative w-full" ref={ref}>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-[14px] opacity-40">⌕</span>
        <input
          type="text"
          placeholder="Search orgs by name, email, phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="w-full h-8 pl-8 pr-3 rounded-full bg-white border border-[var(--color-ink-200)] text-[12.5px] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all placeholder:text-[var(--color-ink-400)]"
        />
        {loading && (
          <span className="absolute right-3 w-3.5 h-3.5 rounded-full border-2 border-t-red-500 border-r-red-500 border-b-transparent border-l-transparent animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-[var(--color-ink-100)] py-1.5 z-50 overflow-hidden">
          {results.map((r, i) => (
            <Link
              key={i}
              href={r.href}
              className="flex flex-col px-3.5 py-2 hover:bg-[var(--color-ink-50)] transition-colors"
            >
              <div className="text-[12.5px] font-medium text-[var(--color-ink-900)] truncate">{r.title}</div>
              <div className="text-[10.5px] text-[var(--color-ink-400)] truncate mt-0.5">{r.subtitle}</div>
            </Link>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-[var(--color-ink-100)] p-3 text-center text-[12px] text-[var(--color-ink-500)] z-50">
          No orgs found for "{query}"
        </div>
      )}
    </div>
  );
}
