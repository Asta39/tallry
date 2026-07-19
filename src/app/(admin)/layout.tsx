import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
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

  const superAdmins = (process.env.SUPER_ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!superAdmins.includes(user.email.toLowerCase())) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)]">
      <AdminSidebar userEmail={user.email} />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl w-full p-4 md:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
