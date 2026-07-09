/**
 * Recurring-schedule math — pure functions, unit-tested in
 * src/lib/__tests__/recurring.test.ts. The DB runner lives in
 * src/lib/recurring-actions.ts.
 */

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
];

/**
 * Advance a YYYY-MM-DD date by one period.
 * Month-based frequencies clamp to the last day of shorter months
 * (Jan 31 + 1 month → Feb 28/29) — standard billing behavior.
 */
export function advance(dateISO: string, frequency: Frequency): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().slice(0, 10);
  }
  const monthsToAdd = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const targetMonthIndex = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * All run dates due on/before `today`, starting from nextRunDate.
 * Capped so a template forgotten for years can't flood the ledger.
 */
export function dueRuns(nextRunDate: string, frequency: Frequency, today: string, cap = 12): string[] {
  const runs: string[] = [];
  let cursor = nextRunDate;
  while (cursor <= today && runs.length < cap) {
    runs.push(cursor);
    cursor = advance(cursor, frequency);
  }
  return runs;
}

export function addDays(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
