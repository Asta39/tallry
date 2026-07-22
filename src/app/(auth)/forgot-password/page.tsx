"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/auth/callback?type=recovery`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

  return (
    <div className="w-full max-w-[400px] px-4">
      {/* Wordmark */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-6">
          <img src="/images/logo.png" alt="Zeno Logo" className="h-12 w-auto object-contain" />
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--color-ink-900)] leading-tight">
          Reset your password
        </h1>
        <p className="text-[13px] text-[var(--color-ink-400)] mt-1.5">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <div className="card p-7">
        {sent ? (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-50)] flex items-center justify-center text-[24px] mx-auto">
              ✉️
            </div>
            <h2 className="text-[16px] font-semibold text-[var(--color-ink-900)]">
              Check your email
            </h2>
            <p className="text-[13px] text-[var(--color-ink-600)] leading-relaxed">
              We sent a password reset link to{" "}
              <strong className="text-[var(--color-ink-900)]">{email}</strong>.
              Click the link to create a new password.
            </p>
            <p className="text-[12px] text-[var(--color-ink-400)]">
              Didn&apos;t get it? Check your spam folder.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
                Email address
              </span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls + " mt-1"}
                placeholder="you@company.co.ke"
              />
            </label>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-[12.5px] text-[var(--color-bad)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13.5px] font-medium py-2.5 transition-colors"
            >
              {pending ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="hairline-t mt-5 pt-5 text-center text-[12.5px] text-[var(--color-ink-400)]">
          Remember it?{" "}
          <Link
            href="/login"
            className="text-[var(--color-accent-600)] font-medium hover:text-[var(--color-accent-700)]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
