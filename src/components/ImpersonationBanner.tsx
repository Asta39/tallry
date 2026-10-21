"use client";

import { useState } from "react";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const [isPending, setIsPending] = useState(false);

  return (
    <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3 no-print z-50 relative">
      <span>⚠️ Impersonating: <strong>{orgName}</strong></span>
      {/* Plain form POST: the server clears the cookie and redirects to /admin directly. */}
      <form method="post" action="/api/admin/impersonate/exit" onSubmit={() => setIsPending(true)}>
        <button
          type="submit"
          disabled={isPending}
          className="bg-white text-red-700 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isPending ? "Exiting..." : "Exit Impersonation"}
        </button>
      </form>
    </div>
  );
}
