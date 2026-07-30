/**
 * Kenya (Africa/Nairobi, UTC+3) is the app's home timezone, but todayISO()
 * in money.ts is naive UTC — using it for a "resets at local midnight"
 * feature would flip 3 hours early/late. This is the one place that
 * actually resolves the Nairobi calendar day.
 */
export function nairobiDateISO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(d);
}
