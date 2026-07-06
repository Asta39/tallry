"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-[12px] text-[var(--color-ink-400)] hover:text-[var(--color-bad)] transition-colors"
      aria-label="Sign out"
    >
      Sign out
    </button>
  );
}
