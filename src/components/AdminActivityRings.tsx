"use client";

import { motion } from "motion/react";

export interface RingMetric {
  label: string;
  /** 0-100 */
  value: number;
  color: string;
  gradientTo: string;
  size: number;
  current: number;
  target: number;
  unit: string;
}

const strokeWidth = 14;

function Ring({ data, index }: { data: RingMetric; index: number }) {
  const radius = (data.size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = circumference - (Math.min(100, data.value) / 100) * circumference;
  const gradientId = `admin-ring-${data.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: index * 0.2, ease: "easeOut" }}
    >
      <svg
        className="-rotate-90"
        width={data.size}
        height={data.size}
        viewBox={`0 0 ${data.size} ${data.size}`}
        role="img"
        aria-label={`${data.label} — ${Math.round(data.value)}%`}
      >
        <title>{`${data.label} — ${Math.round(data.value)}%`}</title>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={data.color} stopOpacity={1} />
            <stop offset="100%" stopColor={data.gradientTo} stopOpacity={1} />
          </linearGradient>
        </defs>
        <circle
          cx={data.size / 2}
          cy={data.size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-100)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={data.size / 2}
          cy={data.size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progress }}
          transition={{ duration: 1.8, delay: index * 0.2, ease: "easeInOut" }}
          style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.12))" }}
        />
      </svg>
    </motion.div>
  );
}

/**
 * Three concentric progress rings, Apple Activity-style, animated with
 * `motion` — a fade+scale entrance per ring plus an animated stroke draw,
 * staggered by index, and the legend numbers fade/slide in alongside.
 */
export function AdminActivityRings({ title, rings }: { title: string; rings: [RingMetric, RingMetric, RingMetric] }) {
  return (
    <div className="flex items-center gap-8 flex-wrap">
      <div className="relative shrink-0" style={{ width: rings[0].size, height: rings[0].size }}>
        {rings.map((ring, i) => (
          <Ring key={ring.label} data={ring} index={i} />
        ))}
      </div>
      <motion.div
        className="flex flex-col gap-4"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
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
      </motion.div>
    </div>
  );
}
