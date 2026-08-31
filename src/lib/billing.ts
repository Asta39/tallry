/**
 * Billing model: every org gets a full-access trial (TRIAL_DAYS) from
 * creation, then a hard lockout until the admin manually activates it (after
 * receiving the one-time setup fee, collected outside the app). Once
 * active, the org has full access to everything — there are no more
 * feature tiers — and pays an admin-set monthly maintenance fee, trackable
 * but not enforced (see BillingStatus below).
 */

export type BillingStatus = "trial" | "active" | "locked";

/** Length of the free trial, in days. Single source of truth — every place
 *  that starts, displays, or explains the trial reads this. */
export const TRIAL_DAYS = 30;

/** Maintenance is billed per active staff member (members table row, not
 *  counting the owner) — KSh 1,000/staff/month. Used to auto-suggest the
 *  monthly fee on activation; the admin can always override it. */
export const PER_STAFF_MONTHLY_FEE_CENTS = 100_000;

export interface SubscriptionRow {
  billingStatus: string; // "trial" | "active" | "suspended" — loose to accept raw DB rows
  trialEndsAt: string; // ISO date
  activatedAt: string | null;
  monthlyFeeCents: number;
  nextMaintenanceDueAt: string | null;
}

export interface Entitlements {
  status: BillingStatus;
  trialEndsAt: string;
  trialDaysLeft: number; // 0 when not on trial or trial has ended
  monthlyFeeCents: number;
  nextMaintenanceDueAt: string | null;
}

/**
 * Pure function over stored state + "today" — mirrors the old
 * resolvePlanAccess()'s shape so callers didn't need a new mental model,
 * just a different result. "locked" covers both a trial that ran out
 * without the admin activating it, and an explicit admin suspension.
 */
export function resolveBillingAccess(
  sub: SubscriptionRow,
  today = new Date().toISOString().slice(0, 10)
): Entitlements {
  let status: BillingStatus;
  if (sub.billingStatus === "suspended") {
    status = "locked";
  } else if (sub.billingStatus === "active") {
    status = "active";
  } else {
    // billingStatus === "trial"
    status = today <= sub.trialEndsAt ? "trial" : "locked";
  }

  const trialDaysLeft =
    status === "trial"
      ? Math.max(0, Math.round((Date.parse(sub.trialEndsAt) - Date.parse(today)) / 86400000))
      : 0;

  return {
    status,
    trialEndsAt: sub.trialEndsAt,
    trialDaysLeft,
    monthlyFeeCents: sub.monthlyFeeCents,
    nextMaintenanceDueAt: sub.nextMaintenanceDueAt,
  };
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsISO(dateISO: string, months: number): string {
  const d = new Date(dateISO + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Last calendar day of dateISO's month, e.g. any January date -> 2026-01-31. */
export function endOfMonthISO(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Last calendar day of the month after dateISO's month — used to advance a
 * maintenance due date by one cycle. Goes via year/month directly (not
 * addMonthsISO on a day-31 date) so Jan 31 -> Feb 28/29, not an overflow
 * into March.
 */
export function nextMonthEndISO(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
}
