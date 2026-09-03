"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Wraps every top-of-screen banner (platform announcement, pinned team
 * announcements, impersonation notice) in one mobile-fixed stack and
 * measures its real rendered height — team announcements' visible count
 * depends on client-side localStorage dismiss state, so the server can't
 * know the exact stack height up front. Publishes it as a CSS variable
 * (--mobile-banner-offset) that the mobile nav pill (Sidebar) and the page
 * content spacer (layout.tsx) both read, so neither ever sits under a
 * banner it didn't know about. On desktop the stack renders in normal flow
 * (md:static) and the variable is simply unused.
 */
export function BannerStack({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      document.documentElement.style.setProperty("--mobile-banner-offset", `${el.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--mobile-banner-offset");
    };
  }, []);

  return (
    <div ref={ref} className="no-print fixed top-0 inset-x-0 z-50 flex flex-col md:static md:z-auto">
      {children}
    </div>
  );
}
