"use client";

import { useState } from "react";

export function ImpersonateButton({ orgId }: { orgId: number }) {
  const [isPending, setIsPending] = useState(false);

  return (
    // Plain form POST: the server sets the cookie and redirects to the org's dashboard directly.
    <form method="post" action="/api/admin/impersonate" onSubmit={() => setIsPending(true)} className="inline">
      <input type="hidden" name="orgId" value={orgId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm font-medium text-[var(--color-accent-600)] hover:underline disabled:opacity-50"
      >
        {isPending ? "Switching..." : "Impersonate"}
      </button>
    </form>
  );
}
