"use client";

import { useTransition } from "react";
import { stopImpersonating } from "@/app/(admin)/admin/actions";

export function ImpersonationBanner({ orgName }: { orgName: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-3 no-print z-50 relative">
      <span>⚠️ Impersonating: <strong>{orgName}</strong></span>
      <button
        onClick={() => startTransition(() => stopImpersonating())}
        disabled={isPending}
        className="bg-white text-red-700 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isPending ? "Exiting..." : "Exit Impersonation"}
      </button>
    </div>
  );
}
