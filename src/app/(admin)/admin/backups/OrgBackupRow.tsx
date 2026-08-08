"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runOrgBackupNow, downloadOrgBackupAction } from "../actions";

type Backup = { name: string; path: string; sizeBytes: number; createdAt: string | null };

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function OrgBackupRow({
  orgId,
  orgName,
  orgEmail,
  backups,
  error,
}: {
  orgId: number;
  orgName: string;
  orgEmail: string | null;
  backups: Backup[];
  error: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const latest = backups[0];

  function backupNow() {
    setLocalError(null);
    start(async () => {
      try {
        await runOrgBackupNow(orgId);
        router.refresh();
      } catch (e) {
        setLocalError(e instanceof Error ? e.message : "Backup failed");
      }
    });
  }

  async function download(path: string) {
    setDownloading(path);
    try {
      const url = await downloadOrgBackupAction(path);
      window.open(url, "_blank");
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Could not create download link");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 text-left min-w-0 flex-1">
          <span className="text-[var(--color-ink-400)] text-[12px] w-4">{open ? "▾" : "▸"}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold truncate">{orgName} <span className="text-[var(--color-ink-400)] font-normal">#{orgId}</span></div>
            <div className="text-[11.5px] text-[var(--color-ink-400)] truncate">{orgEmail || "—"}</div>
          </div>
        </button>
        <div className="text-[12px] text-[var(--color-ink-500)] whitespace-nowrap">
          {error ? (
            <span className="text-[var(--color-bad)]">{error}</span>
          ) : latest ? (
            <>
              {backups.length} snapshot{backups.length === 1 ? "" : "s"} · latest {latest.createdAt?.slice(0, 16).replace("T", " ")} · {fmtBytes(latest.sizeBytes)}
            </>
          ) : (
            <span className="text-amber-700">No backups yet</span>
          )}
        </div>
        <button
          disabled={pending}
          onClick={backupNow}
          className="shrink-0 rounded-lg border border-[var(--color-ink-200)] hover:bg-[var(--color-ink-50)] disabled:opacity-60 text-[12.5px] font-medium px-3 py-1.5"
        >
          {pending ? "Backing up…" : "Backup now"}
        </button>
      </div>

      {localError && <div className="px-5 pb-2 text-[12px] text-[var(--color-bad)]">{localError}</div>}

      {open && (
        <div className="border-t border-[var(--color-ink-100)] divide-y divide-[var(--color-ink-100)]">
          {backups.length === 0 && <div className="px-5 py-4 text-[12.5px] text-[var(--color-ink-400)]">No snapshots yet — click "Backup now".</div>}
          {backups.map((b) => (
            <div key={b.path} className="flex items-center justify-between px-5 py-2.5 text-[12.5px]">
              <span className="tnum">{b.createdAt?.slice(0, 19).replace("T", " ") || b.name}</span>
              <span className="text-[var(--color-ink-400)] tnum">{fmtBytes(b.sizeBytes)}</span>
              <button
                disabled={downloading === b.path}
                onClick={() => download(b.path)}
                className="text-[var(--color-accent-600)] font-medium hover:underline disabled:opacity-60"
              >
                {downloading === b.path ? "Preparing…" : "Download"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
