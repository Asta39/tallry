"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "./Tooltip";

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
  inputClassName,
}: {
  options: SearchableOption[];
  value: number | "";
  onChange: (id: number | "") => void;
  placeholder?: string;
  className?: string;
  /** Overrides the input styling — used for the compact document line cells. */
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 50);
  }, [options, query]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => setHighlight(0), [query, open]);

  // Dropdown is rendered in a portal (not a descendant of rootRef), so its
  // position has to be computed from the input's real screen position —
  // this is also what lets it escape an ancestor's `overflow-x-auto`
  // (which, per the CSS overflow spec, implicitly clips the y-axis too),
  // the exact bug that was hiding this list under the document-lines table.
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    function measure() {
      const r = rootRef.current!.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  function pick(id: number) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  const menu = open && menuRect && (
    <div
      className="fixed z-[200] max-h-64 overflow-auto rounded-lg border border-[var(--color-ink-200)] bg-white shadow-lg"
      style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
    >
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
  );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        className={
          inputClassName ??
          "w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-[13px] bg-white"
        }
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
        <Tooltip text="Clear selection" side="left" className="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            type="button"
            aria-label="Clear selection"
            className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] text-sm px-1"
            onClick={() => { onChange(""); setQuery(""); }}
          >
            ×
          </button>
        </Tooltip>
      )}
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
