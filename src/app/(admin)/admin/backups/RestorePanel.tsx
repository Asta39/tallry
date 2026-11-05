"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewRestoreAction, restoreOrgBackupAction } from "../actions";

type PreviewRow = { table: string; current: number; backup: number | null; action: "restore" | "keep"; reason?: string };

/**
 * Preview → confirm → restore for one snapshot. Shows what changes table by
 * table, requires the org's exact name, and tells the admin which backup of
 * the pre-restore state was taken (to undo it).
 */
export function RestorePanel({ orgId, orgName, path, onClose }: { orgId: number; orgName: string; path: string; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState<{ safetyBackupPath?: string; restoredRows?: number } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    previewRestoreAction(orgId, path).then((res) => {
      if (!live) return;
      if (res.error) setError(res.error);
      else {
        setRows(res.rows ?? []);
        setGeneratedAt(res.generatedAt ?? null);
      }
    });
    return () => {
      live = false;
    };
  }, [orgId, path]);

  const changed = (rows ?? []).filter((r) => r.action === "restore" && r.current !== r.backup);
  const kept = (rows ?? []).filter((r) => r.action === "keep");

  function restore() {
    setError(null);
    start(async () => {
      const res = await restoreOrgBackupAction(orgId, path, confirm);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone({ safetyBackupPath: res.safetyBackupPath, restoredRows: res.restoredRows });
      router.refresh();
    });
  }

  return (
    <div className="mx-5 my-3 rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-[12.5px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">Restore {orgName} from this backup</div>
          <div className="text-[var(--color-ink-500)] mt-0.5">
            Snapshot {generatedAt ? generatedAt.slice(0, 19).replace("T", " ") : "…"} UTC. Replaces this organisation&apos;s current data with the snapshot.
            Other organisations are never touched.
          </div>
        </div>
        <button onClick={onClose} className="text-[var(--color-ink-400)] hover:text-[var(--color-ink-700)]" aria-label="Close">
          ✕
        </button>
      </div>

      {done ? (
        <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-3 text-emerald-800">
          Restored {done.restoredRows?.toLocaleString()} rows. The data from just before the restore was saved as
          <code className="mx-1 rounded bg-emerald-50 px-1">{done.safetyBackupPath}</code>— restore that snapshot to undo.
        </div>
      ) : !rows && !error ? (
        <div className="mt-3 text-[var(--color-ink-500)]">Reading the backup…</div>
      ) : rows ? (
        <>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-ink-200)] bg-white">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[var(--color-ink-50)] text-[var(--color-ink-500)]">
                <tr>
                  <th className="text-left font-medium px-3 py-1.5">Table</th>
                  <th className="text-right font-medium px-3 py-1.5">Now</th>
                  <th className="text-right font-medium px-3 py-1.5">After restore</th>
                </tr>
              </thead>
              <tbody>
                {changed.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-[var(--color-ink-500)]">
                      Row counts match — the restore would only roll back edits made since the snapshot.
                    </td>
                  </tr>
                )}
                {changed.map((r) => (
                  <tr key={r.table} className="border-t border-[var(--color-ink-100)]">
                    <td className="px-3 py-1.5 font-mono">{r.table}</td>
                    <td className="px-3 py-1.5 text-right tnum">{r.current.toLocaleString()}</td>
                    <td className={`px-3 py-1.5 text-right tnum ${(r.backup ?? 0) < r.current ? "text-[var(--color-bad)]" : "text-emerald-700"}`}>
                      {(r.backup ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {kept.length > 0 && (
            <div className="mt-2 text-[11.5px] text-[var(--color-ink-500)]">
              Left as they are now: {kept.map((r) => r.table).join(", ")}.
            </div>
          )}
          <div className="mt-2 text-[11.5px] text-[var(--color-ink-600)]">
            Anything created after the snapshot will be removed. A backup of the current data is taken automatically first, so this can be undone.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={`Type "${orgName}" to confirm`}
              className="min-w-[240px] flex-1 rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent-500)]"
            />
            <button
              onClick={restore}
              disabled={pending || confirm.trim() !== orgName.trim()}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-4 py-1.5"
            >
              {pending ? "Restoring…" : "Restore"}
            </button>
          </div>
        </>
      ) : null}
      {error && <div className="mt-2 text-[var(--color-bad)]">{error}</div>}
    </div>
  );
}
