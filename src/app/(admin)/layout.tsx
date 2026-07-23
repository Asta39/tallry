import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/super-admin";
import { AdminSidebar } from "@/components/AdminSidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user || !user.email) {
    redirect("/login");
  }

  if (!(await isSuperAdmin(user.email))) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)]">
      <AdminSidebar userEmail={user.email} />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="h-[76px] md:hidden shrink-0 no-print" />
          <div className="mx-auto max-w-6xl w-full p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
