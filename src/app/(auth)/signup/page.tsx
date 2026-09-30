"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthSplit, FieldBox, ShowPasswordToggle, CheckboxLine, SubmitButton, FormError, mutedLinkCls } from "@/components/auth/AuthSplit";

export default function SignupPage() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      document.cookie = "zeno_returning=1; path=/; max-age=31536000; samesite=lax";
      setSuccess(true);
    });
  }

  const toggle = <ShowPasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />;

  if (success) {
    return (
      <AuthSplit title="Check your email" subtitle="One click to activate your account">
        <div className="rounded-[9px] border border-black/20 px-5 py-6 text-[15px] leading-relaxed text-black/60">
          We sent a confirmation link to <strong className="font-medium text-black">{email}</strong>. Click it to activate your
          account and set up your business.
          <p className="mt-3 text-[13.5px] text-black/40">Didn&apos;t get it? Check your spam folder.</p>
        </div>
        <p className="mt-7 text-center text-[14px] text-black/60">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-black underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit title="Create an account" subtitle="Free to start. No credit card required.">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <FieldBox id="email" label="Email" type="email" autoComplete="email" placeholder="you@company.co.ke" value={email} onChange={setEmail} />
        <FieldBox
          id="new-password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={setPassword}
          trailing={toggle}
        />
        <FieldBox
          id="confirm-password"
          label="Confirm password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="••••••••"
          value={confirm}
          onChange={setConfirm}
          trailing={toggle}
        />

        <div className="space-y-4 pt-1.5 text-[13px] leading-5 text-black/35">
          <CheckboxLine required checked={agreed} onChange={setAgreed}>
            By creating an account, you agree to our{" "}
            <a href="/terms" target="_blank" className={mutedLinkCls}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className={mutedLinkCls}>
              Privacy Policy
            </a>
          </CheckboxLine>
        </div>

        {error && <FormError>{error}</FormError>}

        <SubmitButton pending={pending}>{pending ? "Creating account…" : "Create account"}</SubmitButton>
      </form>

      <p className="mt-7 text-center text-[14px] text-black/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-black underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </AuthSplit>
  );
}
