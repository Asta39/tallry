"use client";

import * as React from "react";
import { motion, type Variants } from "motion/react";

/**
 * Scroll-triggered stagger wrapper — each element fades/slides in once,
 * offset by `animationNum * <delay in the variant>`. `as` picks which
 * element the motion wrapper renders (any tag `motion` exposes, e.g.
 * "div", "p", "h3", "button").
 */
export interface TimelineContentProps extends Omit<React.HTMLAttributes<HTMLElement>, "onAnimationStart"> {
  as?: "div" | "p" | "h1" | "h2" | "h3" | "h4" | "span" | "button";
  animationNum: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  customVariants: Variants;
  children: React.ReactNode;
}

export function TimelineContent({
  as = "div",
  animationNum,
  timelineRef,
  customVariants,
  children,
  className,
  ...rest
}: TimelineContentProps) {
  const MotionTag = (motion as unknown as Record<string, any>)[as];
  return (
    <MotionTag
      custom={animationNum}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={customVariants}
      className={className}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
