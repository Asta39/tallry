"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "Wrong email or password. Please try again."
          : error.message);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2.5 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

  return (
    <div className="w-full max-w-[400px] px-4">
      {/* Wordmark */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-2">
          <img src="/images/logo.png" alt="Zeno Logo" className="h-40 w-auto object-contain" />
        </div>
        <h1 className="text-[22px] font-semibold text-[var(--color-ink-900)] leading-tight">
          Welcome back
        </h1>
        <p className="text-[13px] text-[var(--color-ink-400)] mt-1.5">
          Sign in to your account to continue
        </p>
      </div>

      {/* Card */}
      <div className="card p-7">
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

          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
              Password
            </span>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + " pr-10"}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 text-[12.5px] text-[var(--color-bad)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13.5px] font-medium py-2.5 transition-colors mt-1"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="hairline-t mt-5 pt-5 text-center text-[12.5px] text-[var(--color-ink-400)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="text-[var(--color-accent-600)] font-medium hover:text-[var(--color-accent-700)]"
          >
            Create one free
          </Link>
        </div>
        <div className="mt-3 text-center">
          <Link
            href="/forgot-password"
            className="text-[12px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)]"
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      <p className="text-center text-[11.5px] text-[var(--color-ink-400)] mt-5">
        KRA-ready accounting for Kenyan businesses.
      </p>
      <p className="text-center text-[11px] text-[var(--color-ink-400)] mt-2">
        <a href="/privacy" className="hover:underline">Privacy Policy</a> · <a href="/terms" className="hover:underline">Terms of Service</a>
      </p>
    </div>
  );
}
