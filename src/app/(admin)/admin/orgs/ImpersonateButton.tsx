"use client";

import { useState } from "react";
import { impersonateOrg } from "../actions";

export function ImpersonateButton({ orgId }: { orgId: number }) {
  const [isPending, setIsPending] = useState(false);

  const handleImpersonate = async () => {
    setIsPending(true);
    await impersonateOrg(orgId);
    window.location.href = "/";
  };

  return (
    <button
      onClick={handleImpersonate}
      disabled={isPending}
      className="text-sm font-medium text-[var(--color-accent-600)] hover:underline disabled:opacity-50"
    >
      {isPending ? "Switching..." : "Impersonate"}
    </button>
  );
}
