import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { ZenoHero } from "@/components/ZenoHero";
import { ZenoShowcase } from "@/components/ZenoShowcase";
import { ZenoAI } from "@/components/ZenoAI";
import { ZenoPricing } from "@/components/ZenoPricing";
import { ZenoPerks } from "@/components/ZenoPerks";
import { ZenoFAQ } from "@/components/ZenoFAQ";
import { ZenoFooter } from "@/components/ZenoFooter";
import { PRICING_PACKAGES } from "@/lib/pricing-packages";
import { FAQS } from "@/lib/faq-content";

export const dynamic = "force-dynamic";

// Was inheriting the root layout's generic "Zeno" title/description
// verbatim — this is the one page that most needs its own, since it's the
// only page a search engine or a first-time visitor ever lands on cold.
const TITLE = "Zeno — Accounting, CRM & Payroll Software for Kenyan Businesses";
const DESCRIPTION =
  "KRA-compliant invoicing, M-Pesa reconciliation, and payroll (PAYE, NSSF, SHIF, AHL) in one place. 30-day free trial, module-based pricing — pick Accounting, CRM, and/or Payroll.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/** SoftwareApplication schema — pricing pulled straight from
 *  pricing-packages.ts (the same server-authoritative source the purchase
 *  flow itself uses) so this can never drift from what's actually charged. */
const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Zeno",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: "https://www.zenobooks.co.ke",
  offers: PRICING_PACKAGES.map((pkg) => ({
    "@type": "Offer",
    name: pkg.label,
    price: (pkg.amountCents / 100).toFixed(2),
    priceCurrency: "KES",
  })),
  provider: {
    "@type": "Organization",
    name: "Zeno",
    url: "https://www.zenobooks.co.ke",
    logo: "https://www.zenobooks.co.ke/images/brand/zeno-icon.png",
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@zenobooks.co.ke",
      telephone: "+254115706542",
      contactType: "customer support",
    },
  },
};

/** FAQPage schema — reuses the exact same Q&A content rendered on the page
 *  (src/components/ZenoFAQ.tsx), already verified accurate against the
 *  product's real billing/tax behavior, so there's nothing here that isn't
 *  also visible and true on the page itself. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default async function LandingPage() {
  const user = await getUser();
  if (user) redirect("/home");

  // Returning visitor (has signed in/up on this device before) but no active
  // session right now — skip the marketing pitch and go straight to login.
  const cookieStore = await cookies();
  if (cookieStore.get("zeno_returning")) redirect("/login");

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <ZenoHero />
      <ZenoShowcase />
      <ZenoAI />
      <ZenoPricing />
      <ZenoPerks />
      <ZenoFAQ />
      <ZenoFooter />
    </main>
  );
}
