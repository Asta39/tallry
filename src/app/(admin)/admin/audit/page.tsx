import { db, adminAuditLog } from "@/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  impersonate_start: { label: "Impersonation started", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  impersonate_stop: { label: "Impersonation ended", cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]" },
  plan_change: { label: "Plan changed", cls: "bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border-[var(--color-accent-100)]" },
  super_admin_add: { label: "Super admin added", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  super_admin_remove: { label: "Super admin removed", cls: "bg-red-50 text-red-700 border-red-200" },
};

export default async function AdminAuditPage() {
  const rows = await db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Every sensitive super admin action, newest first. Last 200 entries.</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Who</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((r) => {
                const meta = ACTION_LABELS[r.action] || { label: r.action, cls: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]" };
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-[var(--color-ink-500)] tnum">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-4 py-3 font-medium">{r.actorEmail}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-600)]">
                      {r.targetType === "org" ? `Org #${r.targetId}` : r.targetId || "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-500)] max-w-[320px] truncate" title={r.detail || undefined}>{r.detail || "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-400)]">No admin actions logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
