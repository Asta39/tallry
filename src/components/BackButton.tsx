"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Goes back to whatever screen the user was actually on before this one —
 *  browser history, not a guessed parent route (which would be wrong for
 *  deep-linked pages, e.g. arriving at a document from search vs from its
 *  list). Hidden on first load / when there's nothing in this tab's history
 *  to go back to (a fresh tab, or landing here directly from a bookmark). */
export function BackButton() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1 && document.referrer.includes(window.location.origin));
  }, []);

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className="mr-2 inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-ink-500)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)] transition-colors shrink-0"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
