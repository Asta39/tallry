import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccessCached, MODULES } from "@/lib/access";
import { Sidebar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { InstallPrompt } from "@/components/InstallPrompt";

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

  return (
    <div className="flex min-h-screen" style={access.orgRow.brandColor ? { "--color-brand": access.orgRow.brandColor } as React.CSSProperties : undefined}>
      {access.memberId ? <NotificationBell memberId={access.memberId} /> : null}
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
        <div className="sticky top-14 md:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[var(--color-ink-100)] px-4 py-3 md:py-0 md:px-8 md:h-14 flex items-center justify-between no-print">
          <div className="hidden md:block w-[40px]" /> {/* Spacer for symmetry if needed */}
          <div className="flex-1 max-w-md mx-auto">
            <GlobalSearch />
          </div>
          <div className="hidden md:block w-[40px]" />
        </div>
        <div className="px-4 py-6 md:px-8 md:py-7 max-w-[1200px] w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
