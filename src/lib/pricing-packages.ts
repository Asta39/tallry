/** Module packages offered on the public pricing page. Server-authoritative:
 *  the purchase-request API looks the price up from here by key rather than
 *  trusting whatever amount the client sends, so a tampered request body
 *  can't submit a discounted price. */
export interface PricingPackage {
  key: string;
  label: string;
  modules: string[];
  amountCents: number;
}

export const PRICING_PACKAGES: PricingPackage[] = [
  { key: "crm", label: "CRM", modules: ["CRM"], amountCents: 5_000_000 },
  { key: "crm_accounting", label: "CRM + Accounting", modules: ["CRM", "Accounting"], amountCents: 8_000_000 },
  { key: "crm_accounting_payroll", label: "CRM + Accounting + Payroll", modules: ["CRM", "Accounting", "Payroll"], amountCents: 10_000_000 },
  { key: "crm_payroll", label: "CRM + Payroll", modules: ["CRM", "Payroll"], amountCents: 7_000_000 },
];

export function getPricingPackage(key: unknown): PricingPackage | null {
  if (typeof key !== "string") return null;
  return PRICING_PACKAGES.find((p) => p.key === key) ?? null;
}
