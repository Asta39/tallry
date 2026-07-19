"use client";

import { useState, useTransition } from "react";
import { addSuperAdminAction, removeSuperAdminAction } from "../actions";

export function AddSuperAdminForm() {
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
      const res = await addSuperAdminAction(fd);
      if (res?.error) setError(res.error);
      else {
        setSuccess(true);
        form.reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-4 flex flex-wrap items-end gap-3">
      <label className="flex-1 min-w-[220px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Add super admin by email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="admin@example.com"
          className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors"
      >
        {pending ? "Adding…" : "Add super admin"}
      </button>
      {error && <p className="w-full text-[12.5px] text-[var(--color-bad)]">{error}</p>}
      {success && <p className="w-full text-[12.5px] text-[var(--color-good)]">Added — they&apos;ll get admin access on their next sign-in.</p>}
    </form>
  );
}

export function RemoveSuperAdminButton({ id, email }: { id: number; email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-[11px] text-[var(--color-bad)]">{error}</span>}
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm(`Remove ${email} as super admin?`)) return;
          setError(null);
          startTransition(async () => {
            const res = await removeSuperAdminAction(id);
            if (res?.error) setError(res.error);
          });
        }}
        className="text-[12px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
    </span>
  );
}
