/**
 * Withholding VAT: a KRA-appointed withholding agent pays a VAT-registered
 * supplier net of 2% of the taxable (VAT-exclusive) value of standard-rated
 * supplies and remits that 2% to KRA. Pure helpers, safe on client and server.
 * (Matches live receipts: e.g. 2% × the 16% lines' net of an invoice.)
 */
export const WITHHOLDING_VAT_RATE_BP = 200;

/** 2% of the net value of an invoice's VAT-able lines. */
export function withholdingVatDueCents(lines: { netCents: number; taxRateBp: number }[]): number {
  const vatableNet = lines.filter((l) => l.taxRateBp > 0).reduce((s, l) => s + l.netCents, 0);
  return Math.round((vatableNet * WITHHOLDING_VAT_RATE_BP) / 10_000);
}

/** WHT still expected on an invoice: what's due less what earlier payments
 *  already recorded as withheld. */
export function remainingWithholdingCents(dueCents: number, alreadyWithheldCents: number): number {
  return Math.max(0, dueCents - alreadyWithheldCents);
}
