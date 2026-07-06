/** KES money helpers. All amounts are integer cents. */

export function fmtKES(cents: number, opts?: { signed?: boolean }): string {
  const sign = cents < 0 ? "-" : opts?.signed && cents > 0 ? "+" : "";
  const abs = Math.abs(cents);
  const sh = Math.floor(abs / 100);
  const ct = abs % 100;
  return `${sign}KSh ${sh.toLocaleString("en-KE")}.${ct.toString().padStart(2, "0")}`;
}

/** Compact form for dashboards: KSh 1.2M, KSh 45.3K */
export function fmtKESCompact(cents: number): string {
  const v = cents / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `KSh ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `KSh ${(v / 1_000).toFixed(1)}K`;
  return fmtKES(cents);
}

/** Parse a user-entered amount ("1,250.50") into cents. Returns NaN if invalid. */
export function parseKES(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return NaN;
  const v = Number(cleaned);
  if (!Number.isFinite(v)) return NaN;
  return Math.round(v * 100);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}
