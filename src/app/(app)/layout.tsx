import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import { getAccessCached, MODULES } from "@/lib/access";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { AiAssistantPill } from "@/components/AiAssistantPill";
import { getEntitlements } from "@/lib/billing-server";
import { getDailyBrief } from "@/lib/ai/brief";
import { db, announcements, teamAnnouncements } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import { TeamAnnouncementBanner } from "@/components/TeamAnnouncementBanner";
import { BannerStack } from "@/components/BannerStack";
import { BlurProvider } from "@/components/BlurContext";
import { BlurToggleSwitch } from "@/components/BlurToggleSwitch";
import { BlurScope } from "@/components/BlurScope";

const roleLabels: Record<string, string> = {
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
  hr: "HR",
  inventory: "Inventory",
  staff: "Staff",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const isImpersonating = !!cookieStore.get("impersonated_org_id")?.value;

  if (user.email && !isImpersonating) {
    const { isSuperAdmin } = await import("@/lib/super-admin");
    if (await isSuperAdmin(user.email)) {
      redirect("/admin");
    }
  }

  const access = await getAccessCached();
  // Signed in but neither owner nor staff — needs onboarding
  if (!access || !access.orgRow.name) redirect("/onboarding");

  const ents = await getEntitlements(access.orgRow.id);

  // A trial org that hasn't seen the welcome screen yet (fresh signup —
  // existing pre-trial-system orgs already carry a non-null value here, or
  // are billingStatus "active" so ents.status is never "trial" for them)
  // gets routed there before ever landing on the dashboard.
  if (ents.status === "trial" && !access.orgRow.trialWelcomeSeenAt) {
    redirect("/welcome-trial");
  }

  // Hard lock: trial ran out without the admin activating the org, or the
  // admin explicitly suspended it. Every route is blocked — render a
  // standalone notice instead of the app shell, for every role (not just
  // roles with "settings" permission, since this must never depend on
  // per-user permissions the way a normal page gate would).
  if (ents.status === "locked") {
    const SUPPORT_PHONE = "+254115706542";
    const SUPPORT_PHONE_WA = "254115706542";
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="text-[15px] font-semibold mb-2">Access paused</div>
          <p className="text-[13.5px] text-[var(--color-ink-500)]">
            {access.orgRow.name || "This account"}'s access is currently paused. Contact us to reactivate it.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Call
            </a>
            <a
              href={`https://wa.me/${SUPPORT_PHONE_WA}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[var(--color-ink-200)] hover:border-[var(--color-ink-400)] text-[13px] font-medium px-4 py-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /></svg>
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const planBadgeText = ents.status === "trial" ? `Trial · ${ents.trialDaysLeft}d left` : "Active";
  const [announcement, brief, pinnedTeamAnnouncements] = await Promise.all([
    db.select().from(announcements).where(eq(announcements.active, true)).orderBy(desc(announcements.createdAt)).limit(1).then((r) => r[0]),
    getDailyBrief(access).catch(() => null),
    db
      .select({ id: teamAnnouncements.id, title: teamAnnouncements.title, body: teamAnnouncements.body, color: teamAnnouncements.color })
      .from(teamAnnouncements)
      .where(and(eq(teamAnnouncements.orgId, access.orgId), eq(teamAnnouncements.pinned, true)))
      .orderBy(desc(teamAnnouncements.createdAt)),
  ]);

  return (
    <>
      <BannerStack>
        {announcement && (
          <div className={`no-print h-9 flex items-center justify-center px-4 text-center text-[12.5px] font-medium md:h-auto md:py-2 ${
            announcement.tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-[var(--color-accent-500)] text-white"
          }`}>
            <span className="truncate">{announcement.message}</span>
          </div>
        )}
        <TeamAnnouncementBanner announcements={pinnedTeamAnnouncements} />
        {isImpersonating && <ImpersonationBanner orgName={access.orgRow.name} />}
      </BannerStack>
      <div className="flex min-h-screen" style={access.orgRow.brandColor ? { "--color-brand": access.orgRow.brandColor } as React.CSSProperties : undefined}>
        <InstallPrompt />
        <Sidebar
          orgName={access.orgRow.name}
          orgEmail={user.email}
          logoUrl={access.orgRow.logoUrl}
          perms={MODULES.map((m) => m.key).filter((k) => access.perms.has(k))}
          roleLabel={access.isOwner ? "Owner" : roleLabels[access.role]}
          isAdmin={access.isOwner || access.role === "admin"}
          timeTrackingEnabled={access.orgRow.timeTrackingEnabled}
          topOffsetPx={announcement ? 36 : 0}
          crmEnabled={access.orgRow.crmEnabled}
          accountingEnabled={access.orgRow.accountingEnabled}
          payrollEnabled={access.orgRow.payrollEnabled}
        />
        <BlurProvider>
        <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
          <div
            className="md:hidden shrink-0 no-print"
            style={{ height: `calc(var(--mobile-banner-offset, ${announcement ? 36 : 0}px) + 76px)` }}
          />
          <div className="sticky top-[calc(var(--mobile-banner-offset,0px)+76px)] md:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[var(--color-ink-100)] px-4 py-3 md:py-0 md:px-8 md:h-14 flex items-center justify-between no-print gap-4">
            <div className="flex-1 hidden md:flex items-center gap-3 max-w-[150px]">
              <Link
                href="/settings/billing"
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  ents.status === "trial"
                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "bg-[var(--color-brand)]/10 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ents.status === "trial" ? "M12 8v4m0 4h.01M10.29 3.86l-7.12 12.3A2 2 0 004.88 19h14.24a2 2 0 001.71-2.84l-7.12-12.3a2 2 0 00-3.42 0z" : "M5 13l4 4L19 7"} /></svg>
                {planBadgeText}
              </Link>
            </div>
            <div className="flex-1 flex items-center gap-2 max-w-md mx-auto md:hidden">
              <div className="flex-1 min-w-0">
                <GlobalSearch />
              </div>
              <BlurToggleSwitch />
              <NotificationBell orgId={access.orgId} memberId={access.memberId} variant="inline" />
            </div>
            <div className="hidden md:block flex-1 max-w-md mx-auto">
              <GlobalSearch />
            </div>
            <div className="flex-1 hidden md:flex items-center justify-end gap-3 max-w-[240px]">
              <BlurToggleSwitch withLabel />
              <NotificationBell orgId={access.orgId} memberId={access.memberId} variant="inline" />
            </div>
          </div>
          <div className="px-4 py-6 md:px-8 md:py-7 max-w-[1200px] w-full mx-auto flex-1 flex flex-col">
            <BlurScope>{children}</BlurScope>
          </div>
        </main>
        </BlurProvider>
      </div>
      <AiAssistantPill initialBriefCount={brief?.count ?? 0} brandColor={access.orgRow.brandColor} />
    </>
  );
}
