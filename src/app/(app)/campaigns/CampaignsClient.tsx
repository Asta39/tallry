"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaignAction, sendCampaignAction } from "@/lib/campaigns";

interface Group {
  id: number;
  name: string;
}

interface Campaign {
  id: number;
  name: string;
  message: string;
  status: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const labelCls = "text-[12px] font-medium text-[var(--color-ink-600)]";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[var(--color-ink-100)] text-[var(--color-ink-500)]",
  sending: "bg-amber-50 text-amber-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export function CampaignsClient({ groups, campaigns }: { groups: Group[]; campaigns: Campaign[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!groupId) return setError("Pick a customer group");
    start(async () => {
      try {
        await createCampaignAction(name, Number(groupId), message);
        setName("");
        setGroupId("");
        setMessage("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create campaign");
      }
    });
  }

  function send(id: number) {
    setError(null);
    setSendingId(id);
    start(async () => {
      try {
        await sendCampaignAction(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not send campaign");
      } finally {
        setSendingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className={labelCls}>Campaign name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="September promo" />
        </label>
        <label className="block">
          <span className={labelCls}>Customer group</span>
          <select required value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputCls}>
            <option value="">Pick a group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {groups.length === 0 && (
            <span className="text-[11px] text-[var(--color-ink-400)] block mt-1">
              No customer groups yet — create one under Customers &amp; Vendors → Groups first.
            </span>
          )}
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Message</span>
          <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="What you want to tell them…" />
        </label>
        {error && <div className="col-span-2 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
        <div className="col-span-2">
          <button
            disabled={pending}
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2.5"
          >
            {pending && sendingId === null ? "Saving…" : "Save as draft"}
          </button>
        </div>
      </form>

      {campaigns.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No campaigns yet — draft one above.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="hairline-b">
              <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left px-4 py-2.5 font-semibold">Campaign</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold">Recipients</th>
                <th className="text-left px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="hairline-t">
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-medium">{c.name}</div>
                    <div className="text-[12px] text-[var(--color-ink-400)] mt-0.5 max-w-[360px] truncate">{c.message}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[c.status] ?? STATUS_STYLE.draft}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px]">
                    {c.status === "draft" ? "—" : `${c.successCount}/${c.recipientCount} sent${c.failureCount > 0 ? `, ${c.failureCount} failed` : ""}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.status === "draft" && (
                      <button
                        disabled={pending}
                        onClick={() => send(c.id)}
                        className="rounded-lg bg-[var(--color-ink-900)] hover:bg-black disabled:opacity-50 text-white text-[12px] font-medium px-3 py-1.5"
                      >
                        {sendingId === c.id ? "Sending…" : "Send now"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
