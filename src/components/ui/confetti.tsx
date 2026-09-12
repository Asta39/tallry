"use client";

import * as React from "react";
import confetti, { type Options as ConfettiOptions } from "canvas-confetti";

export interface ConfettiRef {
  fire: (options?: ConfettiOptions) => void;
}

export interface ConfettiProps extends React.HTMLAttributes<HTMLCanvasElement> {
  /** Options merged into every fire() call — defaults applied once per instance. */
  globalOptions?: ConfettiOptions & Parameters<typeof confetti.create>[1];
  /** Skip the automatic on-mount burst; caller fires manually via the ref. */
  manualstart?: boolean;
}

/** Canvas-confetti wrapped as a component with an imperative `fire()` ref —
 *  same shape as the magicui Confetti component (own implementation here
 *  since we don't have shadcn CLI access in this environment to pull the
 *  registry source directly). */
export const Confetti = React.forwardRef<ConfettiRef, ConfettiProps>(
  ({ globalOptions, manualstart = false, className, ...rest }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const instanceRef = React.useRef<ReturnType<typeof confetti.create> | null>(null);

    React.useEffect(() => {
      if (!canvasRef.current) return;
      instanceRef.current = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true,
        ...globalOptions,
      });
      return () => {
        instanceRef.current?.reset();
        instanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fire = React.useCallback((options?: ConfettiOptions) => {
      instanceRef.current?.({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ...options,
      });
    }, []);

    React.useImperativeHandle(ref, () => ({ fire }), [fire]);

    React.useEffect(() => {
      if (!manualstart) fire();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manualstart]);

    return <canvas ref={canvasRef} className={className} {...rest} />;
  }
);

Confetti.displayName = "Confetti";
