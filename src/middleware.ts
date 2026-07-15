import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Provider webhooks authenticate themselves (URL token / HMAC signature),
  // never via a browser session — a redirect to /login would silently drop
  // every payment callback.
  if (path.startsWith("/api/payments/webhook/")) {
    // Generous ceiling — providers retry, but nobody legitimate sends 300/min
    if (!rateLimit(`wh:${clientIp(request)}`, 300, 60_000)) {
      return new NextResponse("Too many requests", { status: 429 });
    }
    return;
  }
  // Cron routes authenticate with CRON_SECRET themselves; a login redirect
  // would make Vercel cron "succeed" against /login without running anything.
  if (path.startsWith("/api/cron/")) {
    return;
  }
  // Public receipt links: the token in the URL is the credential.
  // Customer portal (/p/) authenticates with its own phone+OTP session.
  // Rate-limited to blunt token brute-forcing and scraping.
  if (path.startsWith("/r/") || path.startsWith("/p/") || path.startsWith("/portal/")) {
    if (!rateLimit(`pub:${clientIp(request)}`, 60, 60_000)) {
      return new NextResponse("Too many requests", { status: 429 });
    }
    return;
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
