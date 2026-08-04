import { getClientSession } from "@/lib/client-portal/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgBySlug } from "@/lib/portal";
import { logoutAction } from "./logout-action";
import { PortalNav } from "./PortalNav";

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
  const logout = logoutAction.bind(null, orgSlug);

  return (
    <div
      className="min-h-screen bg-[#FAFAFA] font-sans text-[var(--color-ink-900)] flex flex-col"
      style={{ "--color-brand": o.brandColor || "#0f766e" } as React.CSSProperties}
    >
      {/* Floating pill toolbar — Apple-calm chrome (sidebar-chrome translucency,
          hairline border, shadow-card), detached from the viewport edge on all
          sides rather than a conventional full-width sticky header. */}
      <header className="sticky top-0 z-40 px-4 pt-4">
        <div className="max-w-6xl mx-auto flex justify-center">
          <div className="sidebar-chrome hairline shadow-[var(--shadow-card)] rounded-full w-full max-w-3xl px-2 py-1.5 flex items-center gap-1">
            <Link
              href={`/portal/${orgSlug}/dashboard`}
              className="shrink-0 pl-3 pr-4 font-semibold text-[14px] tracking-tight whitespace-nowrap"
            >
              {o.name}
            </Link>
            <div className="border-l border-[var(--color-ink-200)] h-5 shrink-0" />
            <PortalNav orgSlug={orgSlug} />
            <form action={logout} className="shrink-0 ml-auto">
              <button
                type="submit"
                className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-ink-400)] hover:text-[var(--color-ink-900)] hover:bg-[var(--color-ink-100)] transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
