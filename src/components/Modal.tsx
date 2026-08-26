"use client";

import { useEffect } from "react";
import { Tooltip } from "./Tooltip";

export function Modal({
  open,
  onClose,
  title,
  children,
  busy = false,
  maxWidthClass = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** While true, backdrop click and Escape are ignored (mid-request guard). */
  busy?: boolean;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <div
        className={`relative w-full ${maxWidthClass} max-h-[80vh] flex flex-col card !shadow-xl rounded-2xl overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-3.5 hairline-b shrink-0">
          <h2 className="text-[14px] font-semibold text-[var(--color-ink-900)]">{title}</h2>
          <Tooltip text="Close">
            <button
              type="button"
              onClick={() => !busy && onClose()}
              className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--color-ink-400)] hover:bg-[var(--color-ink-50)] hover:text-[var(--color-ink-700)] transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </Tooltip>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
