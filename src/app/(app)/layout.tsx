import { getOrg } from "@/lib/org";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { db, org } from "@/db";
import { eq, and } from "drizzle-orm";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const [o] = await db.select().from(org).where(eq(org.userId, user.id)).limit(1);

  // First-time user — send to onboarding
  if (!o || !o.name) redirect("/onboarding");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={o.name}
        orgEmail={user.email}
        logoUrl={o.logoUrl}
      />
      <main className="flex-1 min-w-0 px-8 py-7 max-w-[1200px]">{children}</main>
    </div>
  );
}
