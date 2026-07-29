"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Rethrow Next.js internal redirect & notFound errors so navigation works
  if (
    error.message?.includes("NEXT_REDIRECT") ||
    error.digest?.includes("NEXT_REDIRECT") ||
    error.digest === "3567963413" ||
    error.digest?.includes("3567963413")
  ) {
    throw error;
  }

  useEffect(() => {
    console.error("App Error Boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-200">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--color-ink-800)]">Something went wrong</h2>
      <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-lg text-left max-w-lg w-full overflow-auto">
        <p className="text-xs font-mono font-semibold text-red-800 break-words">
          {error?.message || error?.name || "Server Component Render Error"}
        </p>
        {error?.digest && (
          <p className="text-[11px] font-mono text-red-600 mt-1">
            Digest: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-xs font-medium transition-colors"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg border border-[var(--color-ink-200)] hover:bg-[var(--color-ink-50)] text-[var(--color-ink-700)] text-xs font-medium transition-colors"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}
