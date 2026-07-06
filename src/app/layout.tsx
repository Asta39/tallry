import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tallry",
  description: "Kenya-first accounting, CRM & inventory — calm and compliant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
