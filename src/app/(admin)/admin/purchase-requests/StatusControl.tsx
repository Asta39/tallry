"use client";

import { useTransition } from "react";
import { setPurchaseRequestStatus } from "./actions";

const STATUSES = ["pending", "contacted", "activated"] as const;

export function StatusControl({ id, status }: { id: number; status: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as (typeof STATUSES)[number];
        startTransition(() => {
          setPurchaseRequestStatus(id, next);
        });
      }}
      className="text-xs border border-[var(--color-ink-200)] rounded px-2 py-1 bg-white disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
