"use client";

import { useState, useTransition } from "react";
import { createAnnouncementAction, deactivateAnnouncementAction } from "../actions";

export function AnnouncementForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await createAnnouncementAction(fd);
      if (res?.error) setError(res.error);
      else {
        setSuccess(true);
        form.reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-4 space-y-3">
      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Message (max 200 chars)</span>
        <textarea
          name="message"
          required
          maxLength={200}
          rows={2}
          placeholder="e.g. Scheduled maintenance Sunday 2am–4am EAT — invoicing will be briefly unavailable."
          className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all resize-none"
        />
      </label>
      <div className="flex items-center gap-3">
        <select name="tone" className="rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px]">
          <option value="info">Info (teal)</option>
          <option value="warn">Warning (amber)</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
        >
          {pending ? "Publishing…" : "Publish to all tenants"}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      {success && <p className="text-[12.5px] text-[var(--color-good)]">Live — every tenant sees it on their next page load. Publishing again replaces it.</p>}
    </form>
  );
}

export function RetractButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => { await deactivateAnnouncementAction(id); })}
      className="text-[12px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
    >
      {pending ? "Retracting…" : "Retract"}
    </button>
  );
}
