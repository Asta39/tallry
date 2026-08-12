"use client";

import { useEffect, useState } from "react";

/** Wraps a screen's money figures (anything using .money-lg/.tnum) with a
 *  one-click privacy blur — for glancing at Bank & M-Pesa on a shared
 *  screen/desk without every amount being visible. Persists per-browser via
 *  localStorage so it stays blurred across reloads until toggled off. */
export function BlurToggleWrapper({ storageKey, children }: { storageKey: string; children: React.ReactNode }) {
  const [blurred, setBlurred] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBlurred(localStorage.getItem(storageKey) === "1");
    setReady(true);
  }, [storageKey]);

  function toggle() {
    const next = !blurred;
    setBlurred(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  }

  return (
    <div className="blur-scope" data-blurred={ready && blurred ? "1" : "0"}>
      <div className="flex justify-end mb-3 no-print">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[12.5px] font-medium px-3 py-1.5"
        >
          <span aria-hidden>{blurred ? "🙈" : "👁️"}</span>
          {blurred ? "Show figures" : "Blur figures"}
        </button>
      </div>
      {children}
    </div>
  );
}
