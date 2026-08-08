"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runAllOrgBackupsNow } from "../actions";

export function BackupAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {result && <span className="text-[12px] text-[var(--color-ink-500)]">{result}</span>}
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            const res = await runAllOrgBackupsNow();
            setResult(`${res.orgsBackedUp} backed up${res.failures.length ? `, ${res.failures.length} failed` : ""}`);
            router.refresh();
          })
        }
        className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2"
      >
        {pending ? "Backing up…" : "Backup all now"}
      </button>
    </div>
  );
}
