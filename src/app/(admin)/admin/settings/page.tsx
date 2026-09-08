import { db, announcements, org } from "@/db";
import { desc } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/super-admin";
import { getPlatformSettings } from "@/lib/platform-settings";
import { PlatformSettingsForm } from "./PlatformSettingsForm";
import { AnnouncementForm, RetractButton } from "../announcements/AnnouncementClient";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();

  const [settings, announcementRows, orgs] = await Promise.all([
    getPlatformSettings(),
    db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(50),
    db.select({ id: org.id, name: org.name }).from(org).orderBy(org.name),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">
          Platform-wide configuration — pricing, the operator org, and the banner every tenant sees.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
        <h2 className="text-[15px] font-semibold mb-4">Pricing &amp; platform org</h2>
        <PlatformSettingsForm
          trialDays={settings.trialDays}
          perStaffFeeKes={settings.perStaffMonthlyFeeCents / 100}
          platformOrgId={settings.platformOrgId}
          orgs={orgs}
          updatedAt={settings.updatedAt}
          updatedByEmail={settings.updatedByEmail}
        />
      </section>

      <section className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5">
        <h2 className="text-[15px] font-semibold">Platform-wide announcement</h2>
        <p className="text-[var(--color-ink-500)] text-[12.5px] mt-1 mb-4">
          Broadcast a banner to every tenant's app — maintenance windows, new features, pricing changes. One live at a time.
        </p>

        <AnnouncementForm />

        <div className="rounded-xl border border-[var(--color-ink-200)] overflow-hidden mt-5">
          <div className="px-5 pt-4 pb-3">
            <h3 className="text-[13.5px] font-semibold">History</h3>
          </div>
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)] border-t border-[var(--color-ink-100)]">
              {announcementRows.map((a) => (
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
              {announcementRows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[var(--color-ink-400)]">Nothing published yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
