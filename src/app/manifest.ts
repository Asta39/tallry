import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes Zeno installable to desktop/phone home screen.
 * Icons are generated dynamically by src/app/app-icon/route.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zeno — Accounting for Kenya",
    short_name: "Zeno",
    description: "KRA-ready accounting, invoicing, M-Pesa reconciliation and reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f5f7",
    theme_color: "#0f766e",
    icons: [
      { src: "/app-icon?size=192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon?size=512&pad=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
