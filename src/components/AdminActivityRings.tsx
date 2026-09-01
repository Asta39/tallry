"use client";

import { useEffect, useState } from "react";

export interface RingMetric {
  label: string;
  /** 0-100 */
  value: number;
  color: string;
  current: number;
  target: number;
  unit: string;
}

/**
 * Three concentric progress rings, Apple Activity-style — reimplemented as
 * plain SVG + a CSS transition (no framer-motion/motion dependency, which
 * this app doesn't otherwise use) so it fits the existing bundle instead of
 * adding an animation library for one component.
 */
export function AdminActivityRings({ title, rings }: { title: string; rings: [RingMetric, RingMetric, RingMetric] }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, []);

  const sizes = [176, 132, 88];
  const strokeWidth = 14;

  return (
    <div className="flex items-center gap-8 flex-wrap">
      <div className="relative shrink-0" style={{ width: sizes[0], height: sizes[0] }}>
        {rings.map((ring, i) => {
          const size = sizes[i];
          const radius = (size - strokeWidth) / 2;
          const circumference = radius * 2 * Math.PI;
          const offset = animate ? circumference - (Math.min(100, ring.value) / 100) * circumference : circumference;
          return (
            <svg
              key={ring.label}
              className="absolute -rotate-90"
              style={{ top: (sizes[0] - size) / 2, left: (sizes[0] - size) / 2 }}
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label={`${ring.label}: ${ring.value}%`}
            >
              <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-ink-100)" strokeWidth={strokeWidth} />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.34, 1.2, 0.64, 1)" }}
              />
            </svg>
          );
        })}
      </div>
      <div className="flex flex-col gap-4">
        <div className="text-[13px] font-semibold text-[var(--color-ink-900)]">{title}</div>
        <div className="flex flex-col gap-3.5">
          {rings.map((ring) => (
            <div key={ring.label} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ring.color }} />
              <span className="text-[11.5px] font-medium text-[var(--color-ink-500)] uppercase tracking-wide w-24">{ring.label}</span>
              <span className="text-[15px] font-semibold tnum" style={{ color: ring.color }}>
                {ring.current}/{ring.target}
                <span className="ml-1 text-[11px] font-normal text-[var(--color-ink-400)]">{ring.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
