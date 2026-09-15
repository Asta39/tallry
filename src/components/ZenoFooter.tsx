"use client";

import Link from "next/link";

const SUPPORT_EMAIL = "hello@zenobooks.co.ke";
const SUPPORT_PHONE = "+254 115 706 542";

const footerLinks = [
  {
    title: "Get started",
    links: [
      { name: "Start free trial", href: "/signup" },
      { name: "Log in", href: "/login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Terms of Service", href: "/terms" },
      { name: "Privacy Policy", href: "/privacy" },
    ],
  },
  {
    title: "Get in touch",
    links: [
      { name: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
      { name: SUPPORT_PHONE, href: `tel:${SUPPORT_PHONE.replace(/\s+/g, "")}` },
    ],
  },
];

export function ZenoFooter() {
  return (
    <footer className="w-full bg-white relative overflow-hidden antialiased [font-synthesis:none]">
      {/* Large stroked wordmark — same treatment as the reference footer,
          in the app's own ink tone rather than a generic gray. */}
      <div className="relative w-full flex justify-center items-end pt-20 md:pt-28 pb-0 z-0">
        <h2 className="text-[100px] sm:text-[140px] md:text-[190px] font-extrabold text-transparent [-webkit-text-stroke:1px_rgba(15,23,42,0.35)] leading-[0.75] select-none -mb-3 md:-mb-5 tracking-tight">
          ZENO
        </h2>
      </div>

      {/* Dark teal panel — same deep field color as the hero's GlyphPortal
          (#0b332f), instead of the reference's blue, so the footer reads as
          this site's own brand color, not a borrowed one. */}
      <div className="relative w-full z-10 min-h-[380px]" style={{ backgroundColor: "#0b332f" }}>
        {/* Fluted-glass panel in place of the reference's shader package —
            vertical reeded lines plus alternating light/shadow "flute"
            columns for the paper-like ribbed depth, and a soft diffused
            highlight where the light catches the glass. No extra dependency. */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              // Diffused paper-light glow, upper-left, where the reference's sheen sits.
              "radial-gradient(55% 70% at 20% 10%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 45%, transparent 75%), " +
              // Alternating flute shading — wide soft columns of light/shadow, the glass's ribbed body.
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 20px, rgba(0,0,0,0.05) 20px, rgba(0,0,0,0.05) 40px), " +
              // Crisp vertical lines marking each flute edge.
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 40px)",
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-14 md:py-20 flex flex-col lg:flex-row justify-between gap-14 lg:gap-8">
          {/* Left side */}
          <div className="flex flex-col justify-between max-w-sm w-full">
            <div className="flex flex-col">
              <span className="text-white text-2xl font-extrabold tracking-tight mb-2">ZENO</span>
              <h3 className="text-white text-xl md:text-[22px] font-medium leading-tight">
                Accounting built for
                <br />
                Kenyan businesses
              </h3>
            </div>

            <div className="flex flex-col gap-2 mt-12 lg:mt-auto pt-8">
              <p className="text-white/70 text-[13px]">
                {SUPPORT_EMAIL} · {SUPPORT_PHONE}
              </p>
              <p className="font-light text-white/60 text-xs md:text-[13px] mt-1">
                © {new Date().getFullYear()} Zeno. All rights reserved.
              </p>
            </div>
          </div>

          {/* Right side — link columns */}
          <div className="flex gap-12 md:gap-20 flex-wrap lg:flex-nowrap">
            {footerLinks.map((section) => (
              <div key={section.title} className="flex flex-col gap-4 min-w-[130px]">
                <h4 className="text-white font-semibold text-[15px] md:text-base">{section.title}</h4>
                <ul className="flex flex-col gap-3">
                  {section.links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-white/65 hover:text-white transition-colors text-[13px] md:text-sm font-medium"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
