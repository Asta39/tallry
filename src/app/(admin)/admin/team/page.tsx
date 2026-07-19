import { db, superAdmins } from "@/db";
import { desc } from "drizzle-orm";
import { getUser } from "@/lib/supabase/server";
import { AddSuperAdminForm, RemoveSuperAdminButton } from "./TeamClient";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const user = await getUser();
  const rows = await db.select().from(superAdmins).orderBy(desc(superAdmins.createdAt));
  const envAdmins = (process.env.SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Super Admins</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">
          People who can access this admin panel. They skip business onboarding entirely — no org is created for them.
        </p>
      </div>

      <AddSuperAdminForm />

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Added by</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {envAdmins.map((e) => (
                <tr key={`env-${e}`}>
                  <td className="px-4 py-3 font-medium">{e}{user?.email?.toLowerCase() === e && <span className="ml-2 text-[11px] text-[var(--color-ink-400)]">(you)</span>}</td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">Environment (bootstrap)</span></td>
                  <td className="px-4 py-3 text-[var(--color-ink-400)]">—</td>
                  <td className="px-4 py-3 text-[var(--color-ink-400)]">—</td>
                  <td className="px-4 py-3 text-right text-[11px] text-[var(--color-ink-400)]">managed in env vars</td>
                </tr>
              ))}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.email}{user?.email?.toLowerCase() === r.email && <span className="ml-2 text-[11px] text-[var(--color-ink-400)]">(you)</span>}</td>
                  <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Admin panel</span></td>
                  <td className="px-4 py-3">{r.addedBy || "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">{r.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right">
                    {user?.email?.toLowerCase() !== r.email && <RemoveSuperAdminButton id={r.id} email={r.email} />}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && envAdmins.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--color-ink-400)]">No super admins configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[12px] text-[var(--color-ink-400)]">
        New super admins must sign up for an account first (or already have one) using the same email.
        The next time they sign in they&apos;ll land here instead of the business app.
      </p>
    </div>
  );
}
