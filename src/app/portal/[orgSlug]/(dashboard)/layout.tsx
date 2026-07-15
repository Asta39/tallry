import { getClientSession } from "@/lib/client-portal/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgBySlug } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function ClientPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getClientSession(orgSlug);

  if (!session) {
    redirect(`/portal/${orgSlug}/login`);
  }

  const o = session.org;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-[var(--color-ink-900)] flex flex-col">
      <header className="bg-white border-b border-[var(--color-ink-100)] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="font-bold text-lg">{o.name}</div>
            <nav className="hidden md:flex gap-6 text-[14px] font-medium text-[var(--color-ink-600)]">
              <Link href={`/portal/${orgSlug}/dashboard`} className="hover:text-[var(--color-ink-900)] transition-colors">Overview</Link>
              <Link href={`/portal/${orgSlug}/documents`} className="hover:text-[var(--color-ink-900)] transition-colors">Invoices & Quotes</Link>
              <Link href={`/portal/${orgSlug}/deals`} className="hover:text-[var(--color-ink-900)] transition-colors">Projects</Link>
              <Link href={`/portal/${orgSlug}/knowledge`} className="hover:text-[var(--color-ink-900)] transition-colors">Help & Articles</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href={`/portal/${orgSlug}/login`} // A simple way to log out would be to clear cookie, but for now just link to login which will clear it if they re-authenticate, or we can add a logout button.
              className="text-[13px] text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"
            >
              Log out
            </Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
