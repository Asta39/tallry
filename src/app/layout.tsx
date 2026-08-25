import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zeno",
  description: "Kenya-first accounting, CRM & inventory — calm and compliant.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Zeno",
  },
  icons: {
    icon: "/icon.png",
    apple: "/app-icon?size=192",
  },
  verification: {
    google: "gZJE073WRIN-J15WdFIVc3HRaNo-5JT7LfYyX-7LAp4",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766d77",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
