import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Provider webhooks authenticate themselves (URL token / HMAC signature),
  // never via a browser session — a redirect to /login would silently drop
  // every payment callback.
  if (request.nextUrl.pathname.startsWith("/api/payments/webhook/")) {
    return;
  }
  // Public receipt links: the token in the URL is the credential.
  if (request.nextUrl.pathname.startsWith("/r/")) {
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
