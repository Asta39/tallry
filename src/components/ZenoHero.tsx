"use client";

import Link from "next/link";
import GlyphPortal from "@/components/ui/glyph-portal";

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export function ZenoHero() {
  return (
    <div data-zeno-hero style={{ width: "100%", fontFamily: SYSTEM_FONT }}>
      <style>{`
        [data-zeno-hero] [data-gp-caption]{inset:calc(var(--gp-word-bottom,50%) + 82px) 24px auto;justify-content:center;}
        [data-zeno-hero] [data-gp-hint]{display:none;}
        [data-zeno-hero] [data-gp-enter]{min-height:46px;padding:0 20px;gap:24px;background:#0f766e;border:1px solid #0c5951;border-radius:10px;color:#fff;font-size:13px;font-weight:600;box-shadow:0 1px 2px rgba(12,89,81,.16);transition:background .18s,box-shadow .18s;}
        [data-zeno-hero] [data-gp-enter]:hover{background:#0c5951;box-shadow:0 3px 8px rgba(12,89,81,.2);}
        [data-zeno-hero] [data-gp-enter]:focus-visible{outline:2px solid #0f766e;outline-offset:4px;}
        [data-zeno-hero] [data-gp-touch-picker]{top:auto;bottom:18px;left:50%;}
        [data-zeno-hero] [data-gp-select]{border-color:transparent;border-radius:8px;font-size:12px;color:#54545a;}
        [data-zeno-header]{position:absolute;inset:clamp(20px,4.5cqw,40px) clamp(20px,5cqw,56px) auto;display:flex;align-items:center;justify-content:space-between;gap:16px;}
        [data-zeno-logo]{display:flex;align-items:center;gap:8px;font-size:17px;font-weight:700;letter-spacing:-.02em;color:#181818;}
        [data-zeno-logo] span{display:inline-flex;width:26px;height:26px;border-radius:7px;background:#0f766e;color:#fff;align-items:center;justify-content:center;font-size:13px;font-weight:800;}
        [data-zeno-tag]{font-size:11.5px;line-height:1.5;color:#75757c;text-align:right;}
        [data-zeno-eyebrow]{position:absolute;inset:auto 24px calc(100% - var(--gp-word-top,35%) + 30px);margin:0;text-align:center;font-size:12.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#0f766e;}
        [data-zeno-support]{position:absolute;inset:calc(var(--gp-word-bottom,50%) + 30px) 24px auto;margin:0;text-align:center;font-size:16px;font-weight:400;line-height:1.5;color:#48484a;max-width:34ch;left:50%;transform:translateX(-50%);}
        [data-zeno-scroll]{position:absolute;inset:auto 24px 6%;text-align:center;color:#96969c;font-size:11px;letter-spacing:.02em;}
        @media(any-pointer:coarse){[data-zeno-scroll]{bottom:12%;}}
        @container(max-width:450px){[data-zeno-tag]{max-width:14ch;}[data-zeno-eyebrow]{font-size:11px;}[data-zeno-support]{font-size:14px;}[data-zeno-hero] [data-gp-caption]{top:calc(var(--gp-word-bottom,50%) + 74px);}}
        @container(max-height:479px){[data-zeno-header]{top:18px;}[data-zeno-support]{top:calc(var(--gp-word-bottom,50%) + 14px);}[data-zeno-hero] [data-gp-caption]{top:calc(var(--gp-word-bottom,50%) + 58px);}[data-zeno-scroll]{display:none;}}
        [data-zeno-hero] [data-gp-content]{padding:5.5rem clamp(1.25rem,5cqw,5rem) 6.5rem;font-family:inherit;}
        [data-zeno-copy]{display:flex;width:min(100%,80rem);margin:auto;flex-direction:column;align-items:flex-start;gap:clamp(2rem,5svh,3.5rem);}
        [data-zeno-copy] h2{max-width:44rem;margin:0;color:inherit;font-size:clamp(1.6rem,1.1rem + 1.8cqw,2.15rem);font-weight:400;line-height:1.28;letter-spacing:0;text-wrap:balance;}
        [data-zeno-features]{display:grid;width:100%;grid-template-columns:1fr;gap:1.75rem;}
        [data-zeno-feature]{border-top:1px solid rgba(251,251,250,.2);padding-top:1.1rem;}
        [data-zeno-feature] h3{margin:0;color:inherit;font-size:1.0625rem;font-weight:600;line-height:1.25;letter-spacing:0;}
        [data-zeno-feature] p{margin:.5rem 0 0;color:rgba(251,251,250,.82);font-size:.9rem;line-height:1.55;}
        [data-zeno-no]{display:inline-block;margin-right:.65rem;color:rgba(251,251,250,.7);font:600 .72rem ui-monospace,monospace;letter-spacing:.06em;transform:translateY(-.08em);}
        [data-zeno-cta]{display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:0 22px;border-radius:10px;background:#fff;color:#0f172a;font-size:13.5px;font-weight:600;text-decoration:none;}
        @container(min-width:768px){[data-zeno-features]{grid-template-columns:repeat(3,minmax(0,1fr));gap:3rem;}}
      `}</style>
      <GlyphPortal
        word="ZENO"
        fontFamily={SYSTEM_FONT}
        fontWeight={800}
        scrollLength={2.2}
        interactive={true}
        annotations={false}
        enterLabel="See how it works"
        style={{ "--gp-field": "#0b332f", "--gp-paper": "#fff", "--gp-ink": "#181818", "--gp-foreground": "#fbfbfa" }}
        front={
          <>
            <div data-zeno-header>
              <div data-zeno-logo><span>Z</span>Zeno</div>
              <div data-zeno-tag>Accounting built for Kenyan businesses</div>
            </div>
            <p data-zeno-eyebrow>KRA-ready · eTIMS · M-Pesa</p>
            <p data-zeno-support>Invoicing, payroll, and books that actually reconcile — from quote to VAT return, in one place.</p>
            <span data-zeno-scroll>Scroll to see how it works ↓</span>
          </>
        }
      >
        <div data-zeno-copy>
          <h2>Everything your business needs to get paid, pay staff, and stay compliant.</h2>
          <div data-zeno-features>
            <div data-zeno-feature>
              <h3><span data-zeno-no>01</span>Invoices that file themselves</h3>
              <p>KRA-compliant VAT on every line, eTIMS-ready, with quotes that convert to invoices in one click.</p>
            </div>
            <div data-zeno-feature>
              <h3><span data-zeno-no>02</span>M-Pesa that actually reconciles</h3>
              <p>STK push, Kopo Kopo, and bank statements matched automatically against real invoices and bills.</p>
            </div>
            <div data-zeno-feature>
              <h3><span data-zeno-no>03</span>Payroll, done properly</h3>
              <p>PAYE, NSSF, SHIF, AHL calculated automatically — with real staff loans and salary advances.</p>
            </div>
          </div>
          <Link data-zeno-cta href="/signup">
            Start your free trial <span aria-hidden="true">→</span>
          </Link>
        </div>
      </GlyphPortal>
    </div>
  );
}
