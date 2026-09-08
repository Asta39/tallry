"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOrgNoteAction } from "../../actions";

interface Note {
  id: number;
  authorEmail: string;
  content: string;
  createdAt: string;
}

export function OrgNotesPanel({ orgId, notes }: { orgId: number; notes: Note[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!content.trim()) return setError("Write something first");
    start(async () => {
      try {
        await addOrgNoteAction(orgId, content);
        setContent("");
        router.refresh();
      } catch (err: any) {
        setError(err?.message || "Could not save note");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="Spoke to owner, paying Friday…"
          className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all resize-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--color-ink-900)] hover:bg-black disabled:opacity-60 text-white text-[12.5px] font-medium px-3.5 py-1.5"
          >
            {pending ? "Saving…" : "Add note"}
          </button>
          {error && <span className="text-[12px] text-[var(--color-bad)]">{error}</span>}
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-ink-400)]">No notes yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="text-[12.5px] border-t border-[var(--color-ink-100)] pt-2.5 first:border-t-0 first:pt-0">
              <div className="text-[var(--color-ink-900)] whitespace-pre-wrap">{n.content}</div>
              <div className="text-[11px] text-[var(--color-ink-400)] mt-1">{n.authorEmail} · {n.createdAt.slice(0, 16).replace("T", " ")}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
