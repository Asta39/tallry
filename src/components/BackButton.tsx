"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";
import { parentRoute } from "@/lib/nav";

const STACK_KEY = "zeno-nav-stack";

function readStack(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STACK_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Back button shown in the app's top bar on every screen except Home.
 * Goes back to whatever screen the user was actually on in this tab (an
 * in-app history stack kept in sessionStorage, since document.referrer
 * doesn't change on client-side navigation). When there's nothing to go
 * back to — a fresh tab, a bookmark, a link from an email — it goes up to
 * the parent screen instead, so it's never a dead button.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const stack = readStack();
    if (stack[stack.length - 1] !== pathname) {
      // Arriving at the screen below the top = the user went back.
      if (stack[stack.length - 2] === pathname) stack.pop();
      else stack.push(pathname);
    }
    const trimmed = stack.slice(-50);
    try {
      sessionStorage.setItem(STACK_KEY, JSON.stringify(trimmed));
    } catch {}
    setCanGoBack(trimmed.length > 1);
  }, [pathname]);

  if (pathname === "/home") return null;

  return (
    <Tooltip text="Back" side="bottom" className="shrink-0">
      <button
        type="button"
        onClick={() => (canGoBack ? router.back() : router.push(parentRoute(pathname)))}
        aria-label="Back"
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-ink-500)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </Tooltip>
  );
}
