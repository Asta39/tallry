"use client";

import { useCallback, useEffect, useRef } from "react";

// Adapted from Magic UI's MorphingText (https://magicui.design/docs/components/morphing-text),
// hand-ported instead of pulled via `npx shadcn add` — this project has no
// shadcn/components.json setup, and the pill needs a small single-line size
// plus an on/off switch (only morphs while dormant, freezes to a fixed label
// once the panel is open) that the stock component doesn't expose.
const MORPH_TIME = 1.1;
const COOLDOWN_TIME = 2.2;

function useMorphingText(texts: string[], enabled: boolean, frozenText: string) {
  const textIndexRef = useRef(0);
  const morphRef = useRef(0);
  const cooldownRef = useRef(0);
  const timeRef = useRef(new Date());

  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  const setStyles = useCallback(
    (fraction: number) => {
      const [current1, current2] = [text1Ref.current, text2Ref.current];
      if (!current1 || !current2) return;

      current2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

      const invertedFraction = 1 - fraction;
      current1.style.filter = `blur(${Math.min(8 / invertedFraction - 8, 100)}px)`;
      current1.style.opacity = `${Math.pow(invertedFraction, 0.4) * 100}%`;

      current1.textContent = texts[textIndexRef.current % texts.length];
      current2.textContent = texts[(textIndexRef.current + 1) % texts.length];
    },
    [texts]
  );

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;
    let fraction = morphRef.current / MORPH_TIME;
    if (fraction > 1) {
      cooldownRef.current = COOLDOWN_TIME;
      fraction = 1;
    }
    setStyles(fraction);
    if (fraction === 1) textIndexRef.current++;
  }, [setStyles]);

  const doCooldown = useCallback(() => {
    morphRef.current = 0;
    const [current1, current2] = [text1Ref.current, text2Ref.current];
    if (current1 && current2) {
      current2.style.filter = "none";
      current2.style.opacity = "100%";
      current1.style.filter = "none";
      current1.style.opacity = "0%";
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Frozen state: show the fixed label plainly, no blur/opacity morph.
      const [current1, current2] = [text1Ref.current, text2Ref.current];
      if (current1) {
        current1.textContent = frozenText;
        current1.style.filter = "none";
        current1.style.opacity = "100%";
      }
      if (current2) {
        current2.textContent = "";
        current2.style.opacity = "0%";
      }
      return;
    }

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const newTime = new Date();
      const dt = (newTime.getTime() - timeRef.current.getTime()) / 1000;
      timeRef.current = newTime;
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) doMorph();
      else doCooldown();
    };
    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [enabled, frozenText, doMorph, doCooldown]);

  return { text1Ref, text2Ref };
}

export function MorphingPillText({
  texts,
  enabled,
  frozenText,
  className = "",
}: {
  texts: string[];
  /** True = cycle through `texts` (pill dormant). False = freeze on `frozenText` (panel open). */
  enabled: boolean;
  frozenText: string;
  className?: string;
}) {
  const { text1Ref, text2Ref } = useMorphingText(texts, enabled, frozenText);
  return (
    <span className={`relative inline-block h-[18px] min-w-[68px] text-left ${className}`}>
      <span ref={text1Ref} className="absolute inset-y-0 left-0 inline-block whitespace-nowrap" />
      <span ref={text2Ref} className="absolute inset-y-0 left-0 inline-block whitespace-nowrap" />
    </span>
  );
}
