"use client";

import { useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";

export const ANNOUNCEMENT_COLORS: Record<string, { bar: string; text: string; dot: string; label: string }> = {
  blue: { bar: "bg-[var(--color-accent-500)]", text: "text-white", dot: "bg-white/70", label: "Blue" },
  red: { bar: "bg-red-600", text: "text-white", dot: "bg-white/70", label: "Red" },
  amber: { bar: "bg-amber-100", text: "text-amber-900", dot: "bg-amber-500", label: "Amber" },
  green: { bar: "bg-emerald-600", text: "text-white", dot: "bg-white/70", label: "Green" },
  purple: { bar: "bg-violet-600", text: "text-white", dot: "bg-white/70", label: "Purple" },
  teal: { bar: "bg-teal-600", text: "text-white", dot: "bg-white/70", label: "Teal" },
  pink: { bar: "bg-pink-600", text: "text-white", dot: "bg-white/70", label: "Pink" },
  slate: { bar: "bg-[var(--color-ink-800)]", text: "text-white", dot: "bg-white/70", label: "Slate" },
};

export interface PinnedAnnouncement {
  id: number;
  title: string;
  body: string;
  color: string;
}

/**
 * Pinned team announcements shown at the top of the screen, same slot/style
 * as the super-admin platform banner in layout.tsx — not buried in the
 * notification bell. Dismissal is per-browser (localStorage) so it doesn't
 * nag forever, but reappears for anyone who hasn't dismissed that specific
 * announcement yet (new staff, other devices).
 */
export function TeamAnnouncementBanner({ announcements }: { announcements: PinnedAnnouncement[] }) {
  const [dismissed, setDismissed] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("dismissed_announcements");
      setDismissed(raw ? JSON.parse(raw) : []);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  function dismiss(id: number) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem("dismissed_announcements", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="no-print">
      {visible.map((a) => {
        const c = ANNOUNCEMENT_COLORS[a.color] || ANNOUNCEMENT_COLORS.blue;
        return (
          <div key={a.id} className={`flex items-center gap-3 px-4 py-2 text-[12.5px] font-medium ${c.bar} ${c.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
            <span className="truncate">
              <span className="font-semibold">{a.title}</span>
              {a.body ? <span className="opacity-90"> — {a.body}</span> : null}
            </span>
            <Tooltip text="Dismiss" side="left" className="ml-auto shrink-0">
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                className="opacity-70 hover:opacity-100 text-[13px] leading-none px-1"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
