"use client";

import { useEffect, useState, useTransition } from "react";
import { clockInAction, clockOutAction } from "@/lib/time-tracking";

type Shift = {
  id: number;
  clockInAt: string;
  clockOutAt: string | null;
  durationSeconds: number | null;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function splitHMS(totalSeconds: number): [string, string, string] {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [pad(h), pad(m), pad(s)];
}

function Digit({ value, dim }: { value: string; dim?: boolean }) {
  return (
    <span
      className="inline-block tabular-nums"
      style={{
        fontVariantNumeric: "tabular-nums",
        opacity: dim ? 0.55 : 1,
      }}
    >
      {value}
    </span>
  );
}

export function TimeTrackingCard({ initialShift }: { initialShift: Shift | null }) {
  const [shift, setShift] = useState<Shift | null>(initialShift);
  const [now, setNow] = useState<number>(Date.now());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justFinished, setJustFinished] = useState<string | null>(null);

  useEffect(() => {
    if (!shift) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [shift]);

  const elapsedSeconds = shift ? Math.max(0, Math.floor((now - new Date(shift.clockInAt).getTime()) / 1000)) : 0;
  const [hh, mm, ss] = splitHMS(elapsedSeconds);

  const handleClockIn = () => {
    setError(null);
    setJustFinished(null);
    startTransition(async () => {
      try {
        const res = await clockInAction();
        setShift(res.shift as Shift);
        setNow(Date.now());
      } catch (e: any) {
        setError(e.message || "Could not clock in");
      }
    });
  };

  const handleClockOut = () => {
    if (!shift) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await clockOutAction(shift.id);
        const dur = res.shift.durationSeconds ?? elapsedSeconds;
        const [fh, fm] = splitHMS(dur);
        setJustFinished(`${fh}h ${fm}m`);
        setShift(null);
      } catch (e: any) {
        setError(e.message || "Could not clock out");
      }
    });
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-5 transition-colors duration-500"
      style={{
        background: shift
          ? "linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 92%, black), color-mix(in srgb, var(--color-brand) 65%, black))"
          : "var(--color-ink-50)",
        border: shift ? "none" : "0.5px solid var(--color-ink-200)",
      }}
    >
      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          <div
            className="text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: shift ? "rgba(255,255,255,0.75)" : "var(--color-ink-400)" }}
          >
            {shift ? "On the clock" : "Time Tracking"}
          </div>

          {shift ? (
            <div
              className="mt-2 flex items-baseline gap-1 font-mono font-bold leading-none justify-center sm:justify-start"
              style={{
                fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
                letterSpacing: "0.02em",
                color: "white",
                textShadow: "0 0 24px rgba(255,255,255,0.35), 0 0 4px rgba(255,255,255,0.5)",
              }}
            >
              <Digit value={hh} />
              <span className="opacity-60">:</span>
              <Digit value={mm} />
              <span className="opacity-60">:</span>
              <Digit value={ss} />
            </div>
          ) : (
            <div className="mt-2">
              <div className="text-[19px] font-semibold text-[var(--color-ink-900)]">Ready when you are</div>
              {justFinished && (
                <div className="text-[13px] text-[var(--color-good)] mt-1">
                  Shift complete — {justFinished} logged.
                </div>
              )}
              {!justFinished && (
                <div className="text-[13px] text-[var(--color-ink-400)] mt-1">
                  Clock in to start tracking today&apos;s shift.
                </div>
              )}
            </div>
          )}

          {error && <div className="text-[12.5px] text-red-200 mt-2 sm:mt-1">{error}</div>}
        </div>

        <button
          onClick={shift ? handleClockOut : handleClockIn}
          disabled={pending}
          className="shrink-0 rounded-xl px-8 py-3.5 text-[14.5px] font-semibold transition-all active:scale-95 disabled:opacity-60"
          style={
            shift
              ? { background: "white", color: "var(--color-brand)" }
              : { background: "var(--color-brand)", color: "white" }
          }
        >
          {pending ? "…" : shift ? "Clock Out" : "Clock In"}
        </button>
      </div>
    </div>
  );
}
