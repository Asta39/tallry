import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccessCached, MODULES } from "@/lib/access";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { InstallPrompt } from "@/components/InstallPrompt";
import { getEntitlements } from "@/lib/billing-server";
import Link from "next/link";

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

  const access = await getAccessCached();
  // Signed in but neither owner nor staff — needs onboarding
  if (!access || !access.orgRow.name) redirect("/onboarding");

  const ents = await getEntitlements(access.orgRow.id);

  return (
    <div className="flex min-h-screen" style={access.orgRow.brandColor ? { "--color-brand": access.orgRow.brandColor } as React.CSSProperties : undefined}>
      <InstallPrompt />
      <Sidebar
        orgName={access.orgRow.name}
        orgEmail={user.email}
        logoUrl={access.orgRow.logoUrl}
        perms={MODULES.map((m) => m.key).filter((k) => access.perms.has(k))}
        roleLabel={access.isOwner ? "Owner" : roleLabels[access.role]}
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <div className="h-14 md:hidden shrink-0 no-print" />
        <div className="sticky top-14 md:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[var(--color-ink-100)] px-4 py-3 md:py-0 md:px-8 md:h-14 flex items-center justify-between no-print gap-4">
          <div className="flex-1 hidden md:block max-w-[150px]">
            <Link 
              href="/settings/billing" 
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              {ents.plan === 'free' ? 'Free Plan' : ents.plan === 'standard' ? 'Standard Plan' : 'Business Plan'}
            </Link>
          </div>
          <div className="flex-1 max-w-md mx-auto">
            <GlobalSearch />
          </div>
          <div className="flex-1 hidden md:flex justify-end max-w-[150px]">
            {access.memberId ? <NotificationBell memberId={access.memberId} /> : <div className="w-8" />}
          </div>
        </div>
        <div className="px-4 py-6 md:px-8 md:py-7 max-w-[1200px] w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
