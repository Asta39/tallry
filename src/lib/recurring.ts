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
 *
 * A date that was already the last day of its own month always advances to
 * the last day of the target month too, regardless of that day's number —
 * not min(d, lastDay) applied to the raw day. Without this, a template
 * anchored to "run on the last day of every month" permanently downgrades
 * to day 30 the first time it crosses a 30-day month (Mar 31 → Apr 30) and
 * never returns to the 31st in a later 31-day month (Apr 30 → May 30, not
 * May 31) — silently drifting off month-end forever after one short month.
 * Preserving "was month-end" as the cursor advances keeps it anchored.
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
  const lastDayOfSourceMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = d === lastDayOfSourceMonth ? lastDayOfTargetMonth : Math.min(d, lastDayOfTargetMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Last calendar day of dateISO's month, e.g. any August date → 2026-08-31. */
export function endOfMonthISO(dateISO: string): string {
  const [y, m] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
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
