"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnnouncementAction, deleteAnnouncementAction, togglePinAnnouncementAction } from "@/lib/announcements";
import { PrimaryButton, EmptyState } from "@/components/ui";

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdByName: string;
  createdAt: string;
}

export function AnnouncementsClient({ canPost, rows }: { canPost: boolean; rows: AnnouncementRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] mt-1";
  const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

  function submit() {
    setError(null);
    start(async () => {
      try {
        await createAnnouncementAction({ title, body, pinned });
        setTitle(""); setBody(""); setPinned(false);
        setShowForm(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not post");
      }
    });
  }

  return (
    <>
      {canPost && (
        <div className="flex items-center gap-3 mb-4">
          <PrimaryButton onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "+ New announcement"}
          </PrimaryButton>
        </div>
      )}

      {showForm && (
        <div className="card p-5 mb-5 space-y-3">
          <label className="block">
            <span className={label}>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="e.g. Office closed Friday for Mashujaa Day" />
          </label>
          <label className="block">
            <span className={label}>Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className={input + " h-28 resize-none"} placeholder="Write the announcement…" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="accent-[var(--color-accent-500)]" />
            <span className="text-[12.5px] text-[var(--color-ink-600)]">Pin to top</span>
          </label>
          {error && <div className="text-[12.5px] text-[var(--color-bad)]">{error}</div>}
          <PrimaryButton onClick={submit} disabled={pending}>
            {pending ? "Posting…" : "Post announcement"}
          </PrimaryButton>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No announcements yet" body="Post updates, reminders, or notices for your team here — everyone with access sees them in one place." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className={`card p-5 ${r.pinned ? "border-[var(--color-accent-200)] bg-[var(--color-accent-50)]/40" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {r.pinned && <span className="text-[11px] font-semibold text-[var(--color-accent-600)] uppercase tracking-wide">Pinned</span>}
                    <h3 className="text-[15px] font-semibold text-[var(--color-ink-900)]">{r.title}</h3>
                  </div>
                  <p className="text-[13px] text-[var(--color-ink-700)] whitespace-pre-wrap mt-1.5">{r.body}</p>
                  <div className="text-[11.5px] text-[var(--color-ink-400)] mt-2">
                    {r.createdByName} · {new Date(r.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
                {canPost && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      disabled={pending}
                      onClick={() => start(async () => { await togglePinAnnouncementAction(r.id, !r.pinned); router.refresh(); })}
                      className="text-[12px] font-medium text-[var(--color-ink-500)] hover:text-[var(--color-accent-600)]"
                    >
                      {r.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Delete "${r.title}"?`)) return;
                        start(async () => { await deleteAnnouncementAction(r.id); router.refresh(); });
                      }}
                      className="text-[12px] font-medium text-[var(--color-ink-400)] hover:text-[var(--color-bad)]"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
