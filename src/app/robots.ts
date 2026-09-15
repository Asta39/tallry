import type { MetadataRoute } from "next";

const SITE_URL = "https://www.zenobooks.co.ke";

/**
 * Almost every route in this app requires a signed-in session and correctly
 * redirects an anonymous crawler to /login — that's the right behavior for
 * the app itself, but it means only the marketing landing page and the two
 * legal pages should ever be crawled/indexed. Everything else is disallowed
 * explicitly so a crawler doesn't waste budget hitting a wall of redirects.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/terms", "/privacy", "/vs/"],
      disallow: ["/api/", "/login", "/signup", "/forgot-password", "/update-password", "/auth/", "/home", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
