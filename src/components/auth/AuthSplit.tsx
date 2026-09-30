"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { ReactNode } from "react";

// WebGL shader — client only, same pattern as ZenoFooter's FlutedGlass.
const GrainGradient = dynamic(() => import("@paper-design/shaders-react").then((m) => m.GrainGradient), { ssr: false });

/** Gold of the Zeno mark (sampled from /images/logo.png) — stands in for the
 *  reference design's orange in the grain gradient. */
const ZENO_GOLD = "#C0A474";

/**
 * Split auth layout for /login and /signup: form panel on the left, grain-
 * gradient brand panel on the right (stacks on small screens).
 */
export function AuthSplit({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="min-h-screen w-full bg-white p-3 text-black antialiased [font-synthesis:none]">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="flex items-start rounded-md border border-black/20 bg-white px-6 py-10 sm:px-10 lg:px-14 lg:py-20 xl:px-20">
          <div className="mx-auto w-full max-w-[460px]">
            <Link href="/" aria-label="Zeno home" className="mb-10 block w-fit">
              {/* The logo file has wide margins; cover-crop to the wordmark. */}
              <img src="/images/logo.png" alt="Zeno" className="-ml-9 h-11 w-[220px] object-cover" />
            </Link>
            <div>
              <h1 className="whitespace-nowrap text-3xl font-medium tracking-[-0.04em] sm:text-4xl lg:text-[40px] lg:leading-[1.05]">
                {title}
              </h1>
              <p className="mt-2.5 text-base leading-snug text-black/60 sm:text-lg">{subtitle}</p>
            </div>
            <div className="mt-10">{children}</div>
          </div>
        </div>

        <div className="relative flex min-h-[360px] overflow-hidden rounded-md bg-black p-8 text-white sm:min-h-[480px] sm:p-12 lg:min-h-0">
          <GrainGradient
            speed={1}
            scale={1}
            rotation={0}
            offsetX={0}
            offsetY={0}
            softness={0.5}
            intensity={0.5}
            noise={0.25}
            shape="corners"
            frame={2854.5}
            colors={["#FFFFFF", ZENO_GOLD, ZENO_GOLD, "#FFFFFF"]}
            colorBack="#00000000"
            className="absolute inset-0 bg-black"
          />

          <div className="relative z-10 flex h-full w-full flex-col justify-between gap-10">
            <h2 className="max-w-[620px] pt-0 text-5xl font-medium tracking-[-0.05em] text-white sm:text-6xl lg:pt-16 lg:text-[64px] lg:leading-[0.98] xl:text-[70px]">
              Get paid faster,
              <br />
              stay KRA-ready
            </h2>

            <Link
              href="/vs/competitors"
              className="mb-0 inline-flex h-10 w-fit max-w-full items-center gap-2.5 rounded-[9px] border border-white/25 px-4 text-sm font-medium text-white/85 backdrop-blur-sm transition-colors hover:border-white/45 hover:text-white xl:mb-24 xl:text-[15px]"
            >
              <CompareIcon className="size-4 shrink-0" />
              <span className="truncate whitespace-nowrap">See how Zeno compares</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The reference's boxed field: label sits inside the box on the right while
 * it's empty; once there's a value, `trailing` (e.g. a show-password toggle)
 * takes its place.
 */
export function FieldBox({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  id,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  id?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="flex h-11 items-center justify-between gap-3 rounded-[9px] border border-black/20 bg-white px-4 text-[15px] leading-none transition-colors focus-within:border-black/50">
      <input
        id={id}
        type={type}
        value={value}
        required
        aria-label={label}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-black outline-none placeholder:text-black/30"
      />
      {value ? trailing : <span className="shrink-0 text-black">{label}</span>}
    </label>
  );
}

export function ShowPasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      className="shrink-0 text-black/40 transition-colors hover:text-black"
    >
      {shown ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export function CheckboxLine({ children, required, checked, onChange }: { children: ReactNode; required?: boolean; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <span className="relative mt-1 size-3.5 shrink-0">
        <input
          type="checkbox"
          required={required}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer size-full appearance-none rounded-[2px] border border-black/25 bg-white checked:border-black checked:bg-black"
        />
        <svg
          viewBox="0 0 12 12"
          className="pointer-events-none absolute inset-0 hidden size-full p-0.5 text-white peer-checked:block"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3 6.2 5 8.1 9 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-7 flex h-11 w-full items-center justify-center rounded-[9px] border border-black/40 bg-black text-[15px] font-medium text-white transition-colors hover:bg-black/85 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[9px] border border-red-200 bg-red-50 px-4 py-2.5 text-[13.5px] leading-snug text-red-700">
      {children}
    </div>
  );
}

/** Muted underlined link, as the reference uses for Terms / Privacy. */
export const mutedLinkCls = "font-medium text-black/45 underline underline-offset-2 hover:text-black/70";

function CompareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </svg>
  );
}
