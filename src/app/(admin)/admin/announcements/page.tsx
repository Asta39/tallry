import { db, announcements } from "@/db";
import { desc } from "drizzle-orm";
import { AnnouncementForm, RetractButton } from "./AnnouncementClient";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">
          Broadcast a banner to every tenant&apos;s app — maintenance windows, new features, pricing changes. One live at a time.
        </p>
      </div>

      <AnnouncementForm />

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[13.5px] font-semibold">History</h2>
        </div>
        <table className="w-full text-left text-[12.5px]">
          <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
            {rows.map((a) => (
              <tr key={a.id} className={a.active ? "bg-[var(--color-accent-50)]/40" : ""}>
                <td className="px-5 py-3 max-w-[400px]">
                  <div className="truncate" title={a.message}>{a.message}</div>
                  <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                    {a.createdBy || "—"} · {a.createdAt.slice(0, 16).replace("T", " ")}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                    a.tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border-[var(--color-accent-100)]"
                  }`}>{a.tone}</span>
                </td>
                <td className="px-3 py-3">
                  {a.active
                    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">live</span>
                    : <span className="text-[11px] text-[var(--color-ink-400)]">retired</span>}
                </td>
                <td className="px-5 py-3 text-right">{a.active && <RetractButton id={a.id} />}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing published yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
