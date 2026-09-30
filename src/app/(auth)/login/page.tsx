"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AuthSplit, FieldBox, ShowPasswordToggle, SubmitButton, FormError, mutedLinkCls } from "@/components/auth/AuthSplit";

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
      document.cookie = "zeno_returning=1; path=/; max-age=31536000; samesite=lax";
      router.push("/home");
      router.refresh();
    });
  }

  return (
    <AuthSplit title="Welcome back" subtitle="Sign in to your books">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <FieldBox id="email" label="Email" type="email" autoComplete="email" placeholder="you@company.co.ke" value={email} onChange={setEmail} />
        <FieldBox
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={setPassword}
          trailing={<ShowPasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <div className="flex justify-end text-[13px]">
          <Link href="/forgot-password" className={mutedLinkCls}>
            Forgot your password?
          </Link>
        </div>

        {error && <FormError>{error}</FormError>}

        <SubmitButton pending={pending}>{pending ? "Signing in…" : "Sign in"}</SubmitButton>
      </form>

      <p className="mt-7 text-center text-[14px] text-black/60">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-black underline underline-offset-2">
          Create one free
        </Link>
      </p>
      <p className="mt-10 text-center text-[12.5px] text-black/30">
        KRA-ready accounting for Kenyan businesses ·{" "}
        <a href="/privacy" className={mutedLinkCls}>Privacy</a> ·{" "}
        <a href="/terms" className={mutedLinkCls}>Terms</a>
      </p>
    </AuthSplit>
  );
}
