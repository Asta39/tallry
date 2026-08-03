"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { todayISO } from "@/lib/money";
import {
  submitLeaveRequestAction,
  approveLeaveRequestAction,
  rejectLeaveRequestAction,
} from "@/lib/leave-requests";
import { useRealtimeTable } from "@/lib/realtime/useRealtimeTable";

const LEAVE_TYPES = ["annual", "sick", "unpaid", "maternity", "paternity", "compassionate", "other"] as const;

// Raw Postgres Realtime payload shape — column names, not the camelCase
// Drizzle field names the rest of this file uses.
type RawRequestRow = {
  id: number;
  org_id: number;
  member_id: number | null;
  requested_by_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewed_by_name: string | null;
  admin_note: string | null;
};

type Request = {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  requestedByName: string;
  reviewedByName: string | null;
  adminNote: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  unpaid: "Unpaid",
  maternity: "Maternity",
  paternity: "Paternity",
  compassionate: "Compassionate",
  other: "Other",
};

function toRequest(row: RawRequestRow): Request {
  return {
    id: row.id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    requestedByName: row.requested_by_name,
    reviewedByName: row.reviewed_by_name,
    adminNote: row.admin_note,
  };
}

function upsert(list: Request[], r: Request): Request[] {
  return list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list];
}

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${STATUS_STYLE[status] || "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]"}`}>
      {status}
    </span>
  );
}

function SubmitForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      try {
        await submitLeaveRequestAction({
          leaveType: String(fd.get("leaveType") || "annual"),
          startDate: String(fd.get("startDate") || ""),
          endDate: String(fd.get("endDate") || ""),
          reason: String(fd.get("reason") || ""),
        });
        setSuccess(true);
        form.reset();
        setTimeout(() => window.location.reload(), 800);
      } catch (e: any) {
        setError(e.message || "Could not submit request");
      }
    });
  }

  const inputCls = "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-3">
      <h2 className="text-[14px] font-semibold">Request leave</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Leave type</span>
          <select name="leaveType" className={inputCls + " mt-1"} required defaultValue="annual">
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Start date</span>
          <input type="date" name="startDate" defaultValue={todayISO()} className={inputCls + " mt-1"} required />
        </label>
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">End date</span>
          <input type="date" name="endDate" defaultValue={todayISO()} className={inputCls + " mt-1"} required />
        </label>
      </div>
      <label className="block">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Reason</span>
        <input type="text" name="reason" placeholder="e.g. Family trip, medical appointment" className={inputCls + " mt-1"} required />
      </label>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
          {pending ? "Submitting…" : "Submit request"}
        </button>
        {error && <span className="text-[12.5px] text-[var(--color-bad)]">{error}</span>}
        {success && <span className="text-[12.5px] text-[var(--color-good)]">Submitted for review.</span>}
      </div>
    </form>
  );
}

function MyRequestsTable({ requests }: { requests: Request[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b">
        <h2 className="text-[14px] font-semibold">My requests</h2>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{r.startDate} → {r.endDate}</td>
              <td className="px-3 py-2.5 capitalize">{LEAVE_TYPE_LABEL[r.leaveType] || r.leaveType}</td>
              <td className="px-3 py-2.5">
                {r.reason}
                {r.status === "rejected" && r.adminNote && (
                  <div className="text-[11.5px] text-[var(--color-bad)] mt-0.5">Note: {r.adminNote}</div>
                )}
                {r.status === "approved" && r.adminNote && (
                  <div className="text-[11.5px] text-[var(--color-ink-400)] mt-0.5">Note: {r.adminNote}</div>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--color-ink-500)] tnum">{daysBetween(r.startDate, r.endDate)}d</td>
              <td className="px-5 py-2.5"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-8 text-center text-[var(--color-ink-400)]">No requests yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReviewButtons({ id }: { id: number }) {
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (showReject) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (optional)"
          className="w-32 rounded border border-[var(--color-ink-200)] px-1.5 py-1 text-[11.5px]"
        />
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await rejectLeaveRequestAction(id, note); window.location.reload(); })}
          className="text-[11.5px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50"
        >
          Confirm reject
        </button>
        <button onClick={() => setShowReject(false)} className="text-[11.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await approveLeaveRequestAction(id); window.location.reload(); })}
        className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
      >
        Approve
      </button>
      <button onClick={() => setShowReject(true)} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline">Reject</button>
    </div>
  );
}

function ReviewSection({ pending }: { pending: Request[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b flex items-center gap-2.5">
        <h2 className="text-[14px] font-semibold">Pending review</h2>
        <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 tnum">{pending.length}</span>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {pending.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{r.startDate} → {r.endDate}</td>
              <td className="px-3 py-2.5">
                <div>{LEAVE_TYPE_LABEL[r.leaveType] || r.leaveType} · {r.reason}</div>
                <div className="text-[11px] text-[var(--color-ink-400)]">{r.requestedByName}</div>
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--color-ink-500)] tnum">{daysBetween(r.startDate, r.endDate)}d</td>
              <td className="px-5 py-2.5"><ReviewButtons id={r.id} /></td>
            </tr>
          ))}
          {pending.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing pending — all caught up.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HistorySection({ reviewed }: { reviewed: Request[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-4 pb-3 hairline-b">
        <h2 className="text-[14px] font-semibold">Reviewed</h2>
      </div>
      <table className="w-full text-left text-[13px]">
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {reviewed.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-2.5 whitespace-nowrap text-[var(--color-ink-500)]">{r.startDate} → {r.endDate}</td>
              <td className="px-3 py-2.5">
                <div>{LEAVE_TYPE_LABEL[r.leaveType] || r.leaveType} · {r.reason}</div>
                <div className="text-[11px] text-[var(--color-ink-400)]">{r.requestedByName}{r.reviewedByName ? ` · reviewed by ${r.reviewedByName}` : ""}</div>
              </td>
              <td className="px-3 py-2.5 text-right text-[var(--color-ink-500)] tnum">{daysBetween(r.startDate, r.endDate)}d</td>
              <td className="px-5 py-2.5"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
          {reviewed.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing here yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LeaveRequestsClient({
  orgId,
  memberId,
  mine: initialMine,
  canReview,
  pending: initialPending,
  reviewed: initialReviewed,
}: {
  orgId: number;
  memberId: number | null;
  mine: Request[];
  canReview: boolean;
  pending: Request[];
  reviewed: Request[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState(initialMine);
  const [pending, setPending] = useState(initialPending);
  const [reviewed, setReviewed] = useState(initialReviewed);

  const resync = useCallback(() => router.refresh(), [router]);

  useRealtimeTable<RawRequestRow>(
    "leave_requests",
    { column: "org_id", value: orgId },
    {
      onInsert: (row) => {
        const r = toRequest(row);
        const belongsToMe = memberId ? row.member_id === memberId : row.member_id === null;
        if (belongsToMe) setMine((prev) => upsert(prev, r));
        if (canReview && r.status === "pending") setPending((prev) => upsert(prev, r));
      },
      onUpdate: (row) => {
        const r = toRequest(row);
        const belongsToMe = memberId ? row.member_id === memberId : row.member_id === null;
        if (belongsToMe) setMine((prev) => upsert(prev, r));
        if (canReview) {
          setPending((prev) => (r.status === "pending" ? upsert(prev, r) : prev.filter((p) => p.id !== r.id)));
          setReviewed((prev) =>
            r.status === "approved" || r.status === "rejected" ? upsert(prev, r) : prev.filter((p) => p.id !== r.id)
          );
        }
      },
      // Requests are never deleted in this app (rejected is terminal, not a
      // row removal) — an unexpected DELETE resyncs rather than guesses.
      onDelete: resync,
      onUnreliable: resync,
    }
  );

  return (
    <div className="space-y-6">
      <SubmitForm />
      {canReview && <ReviewSection pending={pending} />}
      {canReview && <HistorySection reviewed={reviewed} />}
      <MyRequestsTable requests={mine} />
    </div>
  );
}
