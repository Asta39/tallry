import { todayISO } from "@/lib/money";

export type PeriodPreset =
  | "today"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Date Range…" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turns a preset (plus explicit from/to when preset is "custom") into a
 * concrete date range. Unknown presets fall back to this month.
 */
export function resolvePeriod(sp: { period?: string; from?: string; to?: string }): {
  preset: PeriodPreset;
  from: string;
  to: string;
} {
  const today = todayISO();
  const preset = (PERIOD_OPTIONS.find((o) => o.value === sp.period)?.value ?? "this_month") as PeriodPreset;

  if (preset === "custom") {
    const to = sp.to || today;
    return { preset, from: sp.from || to.slice(0, 8) + "01", to };
  }

  const now = new Date(`${today}T00:00:00Z`);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  switch (preset) {
    case "today":
      return { preset, from: today, to: today };
    case "this_week": {
      // Week starts Monday.
      const dow = (now.getUTCDay() + 6) % 7;
      const monday = new Date(now);
      monday.setUTCDate(now.getUTCDate() - dow);
      return { preset, from: iso(monday), to: today };
    }
    case "last_month": {
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      return { preset, from: iso(start), to: iso(end) };
    }
    case "this_quarter": {
      const start = new Date(Date.UTC(y, Math.floor(m / 3) * 3, 1));
      return { preset, from: iso(start), to: today };
    }
    case "this_year":
      return { preset, from: `${y}-01-01`, to: today };
    default:
      return { preset: "this_month", from: `${today.slice(0, 7)}-01`, to: today };
  }
}
