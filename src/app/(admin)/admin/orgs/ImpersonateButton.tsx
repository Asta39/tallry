"use client";

import { useTransition } from "react";
import { impersonateOrg } from "../actions";

export function ImpersonateButton({ orgId }: { orgId: number }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => impersonateOrg(orgId))}
      disabled={isPending}
      className="text-sm font-medium text-[var(--color-accent-600)] hover:underline disabled:opacity-50"
    >
      {isPending ? "Switching..." : "Impersonate"}
    </button>
  );
}
