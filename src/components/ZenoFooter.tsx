"use client";

import { FlutedGlass } from "@paper-design/shaders-react";
import Link from "next/link";

const companyName = "ZENO";
const SUPPORT_EMAIL = "hello@zenobooks.co.ke";
const SUPPORT_PHONE = "+254 115 706 542";

/** Same 3-column shape as the reference, content swapped to Zeno's real
 *  destinations — the reference's "Careers/Blogs/X/LinkedIn/..." entries
 *  don't exist for Zeno yet, so this only keeps the layout, not the copy. */
const footerLinks = [
  {
    title: "Product",
    links: [
      { name: "Pricing", href: "/#pricing" },
      { name: "FAQ", href: "/#faq" },
      { name: "Start free trial", href: "/signup" },
      { name: "Log in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "Terms", href: "/terms" },
      { name: "Privacy", href: "/privacy" },
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
      {/* Large Stroke Text Section */}
      <div className="relative w-full flex justify-center items-end pt-24 md:pt-32 pb-0 z-0">
        <h1 className="text-[150px] sm:text-[210px] md:text-[280px] font-semibold text-transparent [-webkit-text-stroke:1px_rgba(0,0,0,0.4)] leading-[0.75] select-none -mb-4 md:-mb-6 opacity-50">
          {companyName}
        </h1>
      </div>

      {/* Green Panel Section — same fluted-glass shader as the reference,
          recolored from its blue (#1C76F8) to Zeno's brand teal. */}
      <div className="relative w-full [--color-primary:#0f766e] bg-(--color-primary) z-10 min-h-[400px]">
        {/* Background Shader */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <FlutedGlass
            size={0.89}
            shape="lines"
            angle={0}
            distortionShape="prism"
            distortion={0.5}
            shift={0}
            blur={0}
            edges={0.25}
            stretch={0}
            scale={1.11}
            fit="cover"
            highlights={0.1}
            shadows={0.2}
            grainMixer={0.1}
            grainOverlay={0.1}
            colorBack="#00000000"
            colorHighlight="#FFFFFF"
            colorShadow="#000000"
            className="w-full h-full bg-transparent"
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-24 pt-16 md:pt-24">
          <div className="flex flex-col lg:flex-row justify-between gap-12 lg:gap-8">
            {/* Left Side */}
            <div className="flex flex-col max-w-sm w-full">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white flex items-center justify-center p-1.5 shrink-0 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/admin-logo.jpg" alt="Zeno" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-white text-xl md:text-[22px] font-medium leading-tight">
                Accounting built for
                <br />
                Kenyan businesses
              </h2>
            </div>

            {/* Right Side - Links */}
            <div className="flex gap-10 sm:gap-12 md:gap-24 flex-wrap">
              {footerLinks.map((section) => (
                <div key={section.title} className="flex flex-col gap-5 min-w-[120px]">
                  <h3 className="text-white font-semibold text-lg md:text-xl">{section.title}</h3>
                  <ul className="flex flex-col gap-3 md:gap-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-white/70 hover:text-white transition-colors text-sm md:text-[15px] font-medium"
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

          {/* Copyright — its own row, always last regardless of the above
              stacking to a single column on mobile (a plain doc-order flow
              here would sandwich it between the brand block and the link
              columns instead of anchoring it to the bottom). */}
          <p className="font-light text-white/70 text-xs md:text-[13px] mt-14 md:mt-16 pt-6 border-t border-white/10 pb-10 md:pb-12">
            © {new Date().getFullYear()} Zeno. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
