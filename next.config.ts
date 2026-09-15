import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres", "pdfjs-dist"],
  async redirects() {
    return [
      // Renamed shortly after launch — the named-competitor URL was live
      // just long enough it might already be crawled/shared, so redirect
      // rather than 404.
      { source: "/vs/zoho-books", destination: "/vs/competitors", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vqkagtkanunksungghau.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
