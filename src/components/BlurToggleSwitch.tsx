"use client";

import { useBlur } from "@/components/BlurContext";

/** Header switch for the app-wide money-figure blur — brand-colored pill,
 *  matches the toggle style used elsewhere (e.g. DashboardVisibilityToggles). */
export function BlurToggleSwitch() {
  const { blurred, toggle } = useBlur();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={blurred}
      aria-label={blurred ? "Show figures" : "Blur figures"}
      title={blurred ? "Show figures" : "Blur figures"}
      onClick={toggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        blurred ? "bg-[var(--color-brand)]" : "bg-[var(--color-ink-200)]"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
          blurred ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
