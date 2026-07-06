import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getAccess, MODULES } from "@/lib/access";
import { Sidebar } from "@/components/Sidebar";

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

  const access = await getAccess();
  // Signed in but neither owner nor staff — needs onboarding
  if (!access || !access.orgRow.name) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={access.orgRow.name}
        orgEmail={user.email}
        logoUrl={access.orgRow.logoUrl}
        perms={MODULES.map((m) => m.key).filter((k) => access.perms.has(k))}
        roleLabel={access.isOwner ? "Owner" : roleLabels[access.role]}
      />
      <main className="flex-1 min-w-0 px-4 pt-[72px] pb-8 md:px-8 md:py-7 max-w-[1200px]">
        {children}
      </main>
    </div>
  );
}
