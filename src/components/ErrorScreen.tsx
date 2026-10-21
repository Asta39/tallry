"use client";

import { useEffect } from "react";

/**
 * Shared body for the error boundaries. Shows the error's reference code
 * (Next's digest) — the same id is printed in the server logs next to the
 * real error, so a screenshot is enough to find what went wrong.
 */
export function ErrorScreen({
  error,
  reset,
  where,
  fullPage = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  where: string;
  fullPage?: boolean;
}) {
  // Let Next's own redirect / not-found signals through so navigation works.
  if (error.message?.includes("NEXT_REDIRECT") || error.digest?.includes("NEXT_REDIRECT") || error.digest?.includes("NEXT_NOT_FOUND")) {
    throw error;
  }

  useEffect(() => {
    console.error(`${where} error boundary caught:`, error);
  }, [error, where]);

  return (
    <div className={`${fullPage ? "min-h-screen" : "min-h-[60vh]"} flex flex-col items-center justify-center text-center px-4 py-12`}>
      <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-[15px] font-semibold text-[var(--color-ink-900,#111827)]">Something went wrong loading this page</h2>
      <p className="text-[13px] text-[var(--color-ink-500,#6b7280)] max-w-sm mt-1">Try again — if it keeps happening, send us this reference.</p>
      {error.digest && (
        <code className="mt-3 rounded-md bg-[var(--color-ink-100,#f3f4f6)] px-2 py-1 text-[12px] text-[var(--color-ink-600,#4b5563)] select-all">Ref: {error.digest}</code>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => reset()} className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[13px] font-medium transition-colors">
          Try again
        </button>
        <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 text-[13px] font-medium transition-colors">
          Reload page
        </button>
      </div>
    </div>
  );
}
