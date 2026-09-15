import type { MetadataRoute } from "next";

const SITE_URL = "https://www.zenobooks.co.ke";

/** Only the truly public pages — everything else requires a signed-in
 *  session (see robots.ts and src/lib/supabase/middleware.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
