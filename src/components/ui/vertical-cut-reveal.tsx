"use client";

import * as React from "react";
import { motion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

export interface VerticalCutRevealProps {
  children: string;
  splitBy?: "words" | "characters";
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center";
  reverse?: boolean;
  containerClassName?: string;
  transition?: Transition;
}

/** Splits text into words/characters, each clipped inside its own overflow
 *  box, and slides them into place — the "letters rising out of a slot"
 *  reveal. Staggered by `staggerDuration` from whichever end
 *  `staggerFrom` picks. */
export function VerticalCutReveal({
  children,
  splitBy = "words",
  staggerDuration = 0.1,
  staggerFrom = "first",
  reverse = false,
  containerClassName,
  transition,
}: VerticalCutRevealProps) {
  const parts = splitBy === "words" ? children.split(" ") : children.split("");
  const baseDelay = (transition?.delay as number | undefined) ?? 0;

  const orderIndexOf = (i: number) => {
    if (staggerFrom === "last") return parts.length - 1 - i;
    if (staggerFrom === "center") return Math.abs(i - (parts.length - 1) / 2);
    return i;
  };

  return (
    <span className={cn("inline-flex flex-wrap", containerClassName)}>
      {parts.map((part, i) => (
        <span key={i} style={{ overflow: "hidden", display: "inline-block" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: reverse ? "-100%" : "100%" }}
            animate={{ y: 0 }}
            transition={{ ...transition, delay: baseDelay + orderIndexOf(i) * staggerDuration }}
          >
            {part}
            {splitBy === "words" && i < parts.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
