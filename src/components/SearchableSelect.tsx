"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableOption {
  id: number;
  label: string;
}

/**
 * Combobox: type to filter, click or Enter to pick. Drop-in replacement for
 * the long <select> lists (customers, vendors).
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  options: SearchableOption[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => setHighlight(0), [query, open]);

  function pick(id: number) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-[13px] bg-white"
        value={open ? query : selected?.label ?? ""}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); if (filtered[highlight]) pick(filtered[highlight].id); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {selected && !open && (
        <button
          type="button"
          aria-label="Clear selection"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] text-sm px-1"
          onClick={() => { onChange(""); setQuery(""); }}
        >
          ×
        </button>
      )}
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-[var(--color-ink-200)] bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[12.5px] text-[var(--color-ink-400)]">No matches</div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.id}
                type="button"
                className={`block w-full text-left px-3 py-2 text-[13px] ${i === highlight ? "bg-[var(--color-ink-50)]" : ""} ${o.id === value ? "font-semibold" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(o.id); }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
