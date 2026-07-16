"use client";

import { useEffect, useState } from "react";
import { getNotifications, markNotificationRead } from "@/lib/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function NotificationBell({ memberId }: { memberId: number | null }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getNotifications(memberId);
      setNotifications(data);
    }
    load();
    const interval = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [memberId]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed top-4 right-4 md:top-7 md:right-8 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full bg-white border border-[var(--color-ink-200)] shadow-sm hover:bg-[var(--color-ink-50)] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white translate-x-1/4 -translate-y-1/4">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-[var(--color-ink-200)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)] flex justify-between items-center">
            <h3 className="text-sm font-semibold text-[var(--color-ink-600)]">Notifications</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-[var(--color-ink-400)]">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={async () => {
                    if (!n.isRead) {
                      await markNotificationRead(n.id);
                      setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, isRead: true } : p)));
                    }
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                  className={`p-4 border-b border-[var(--color-ink-100)] hover:bg-[var(--color-ink-50)] cursor-pointer transition-colors ${
                    !n.isRead ? "bg-blue-50/30" : ""
                  }`}
                >
                  <h4 className={`text-sm ${!n.isRead ? "font-semibold text-[var(--color-ink-600)]" : "font-medium text-[var(--color-ink-500)]"}`}>
                    {n.title}
                  </h4>
                  <p className="text-xs text-[var(--color-ink-400)] mt-1">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
