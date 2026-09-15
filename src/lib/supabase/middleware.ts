import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Public paths that don't require authentication */
const PUBLIC_PATHS = [
  "/login", "/signup", "/auth/callback", "/forgot-password", "/update-password",
  // Legal pages — must be readable by anyone (Kenya DPA transparency)
  "/privacy", "/terms",
  // Public comparison/landing pages — same marketing surface as "/"
  "/vs",
  // PWA assets must be reachable without auth
  "/manifest.webmanifest", "/app-icon", "/sw.js",
  // Link-preview image for the homepage share card — same problem as
  // robots.txt/sitemap.xml had: unauthenticated crawlers/link-unfurlers
  // fetching this need real image bytes back, not a login redirect.
  "/opengraph-image",
  // Public marketing-site AI assistant — anonymous visitors on the landing
  // page hit this; it has no db/access/tools wiring (see marketing-assistant.ts)
  "/api/marketing-chat",
  // Public pricing page's one-time-purchase lead form — submitted before
  // any account/org exists.
  "/api/purchase-request",
];

/** Exact-match public paths — startsWith would also match every real app
 *  route (everything starts with "/"), so the marketing landing page needs
 *  its own check instead of joining the prefix list above. robots.txt and
 *  sitemap.xml were falling through to this same auth gate and redirecting
 *  crawlers to /login instead of serving actual robots/sitemap content —
 *  the site had zero pages indexed by Google as a direct result. */
const PUBLIC_EXACT_PATHS = ["/", "/robots.txt", "/sitemap.xml"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST NOT remove this block
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || PUBLIC_EXACT_PATHS.includes(pathname);

  if (!user && !isPublic) {
    // Not logged in → redirect to /login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/")) {
    // Already logged in → redirect to the dashboard, not the marketing page
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
