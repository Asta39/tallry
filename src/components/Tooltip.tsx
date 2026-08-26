"use client";

import { useRef, useState } from "react";

/**
 * Wraps an icon-only control with a floating label. Shows only after a
 * sustained hover/focus (not instantly) so it doesn't flash on every quick
 * mouse pass across a toolbar full of icon buttons.
 */
export function Tooltip({
  text,
  children,
  side = "bottom",
  delayMs = 2000,
  className = "",
}: {
  text: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
  /** Extra classes on the wrapper span — e.g. "ml-auto" to preserve the wrapped element's own flex placement. */
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(true), delayMs);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  };

  const sideClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span
      // "absolute" in a caller's className (e.g. positioning this wrapper
      // itself inside an input) already establishes a positioning context
      // for the popup below — adding "relative" too would fight it for the
      // position property since both are utility classes of equal
      // specificity, and which one wins in the compiled CSS is unspecified.
      className={`${className.includes("absolute") ? "" : "relative"} inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-md bg-[var(--color-ink-900)] px-2 py-1 text-[11px] font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.18)] ${sideClasses[side]}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
