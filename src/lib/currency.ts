/**
 * Document currency (display only). A foreign-currency invoice/quote/credit
 * note is written and shown in that currency, but every line is also stored
 * in KES at the document's exchange rate, and only the KES figures are
 * posted — so the ledger, VAT and reports stay in shillings.
 */
export const CURRENCIES = {
  KES: { symbol: "KSh", name: "Kenyan shilling" },
  USD: { symbol: "US$", name: "US dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British pound" },
} as const;
export type Currency = keyof typeof CURRENCIES;

export function isForeign(currency: string | null | undefined): boolean {
  return !!currency && currency !== "KES" && currency in CURRENCIES;
}

/** Format cents in a document currency, e.g. "US$ 1,250.00". */
export function fmtMoney(cents: number, currency: string | null | undefined = "KES"): string {
  const symbol = CURRENCIES[(currency && currency in CURRENCIES ? currency : "KES") as Currency].symbol;
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}${symbol} ${Math.floor(abs / 100).toLocaleString("en-KE")}.${(abs % 100).toString().padStart(2, "0")}`;
}

/** Foreign cents → KES cents at `rate` KSh per 1 unit of the foreign currency. */
export function toKesCents(foreignCents: number, rate: number): number {
  return Math.round(foreignCents * rate);
}

/** KES cents → foreign cents (for showing KES-side figures such as payments). */
export function fromKesCents(kesCents: number, rate: number): number {
  return rate > 0 ? Math.round(kesCents / rate) : 0;
}
