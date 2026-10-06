/** Quotes that can still be merged — anything not yet converted, declined,
 *  voided or already merged into another quote. */
export const MERGEABLE_QUOTE_STATUSES = ["draft", "open", "accepted"] as const;

type QuoteForMerge = {
  id: number;
  number: string;
  type: string;
  status: string;
  contactId: number | null;
  taxInclusive: boolean;
  notes: string | null;
};

type LineForMerge = {
  itemId: number | null;
  description: string;
  qty: number;
  unitPriceCents: number;
  discountPct: number;
  taxClass: string;
  accountId: number | null;
  customColumnValue: string | null;
  costCenterId: number | null;
  warehouseId: number | null;
  isHeading: boolean;
};

/** Why these quotes can't be merged, or null if they can. */
export function mergeQuotesError(quotes: QuoteForMerge[], requestedCount: number): string | null {
  if (requestedCount < 2) return "Pick at least two quotes to merge";
  if (quotes.length !== requestedCount) return "One of those quotes couldn't be found";
  for (const q of quotes) {
    if (q.type !== "quote") return `${q.number} isn't a quote`;
    if (!(MERGEABLE_QUOTE_STATUSES as readonly string[]).includes(q.status)) {
      return `${q.number} is ${q.status} — only draft, sent or accepted quotes can be merged`;
    }
  }
  const contact = quotes[0].contactId;
  if (!contact || quotes.some((q) => q.contactId !== contact)) return "Quotes can only be merged for the same customer";
  if (quotes.some((q) => q.taxInclusive !== quotes[0].taxInclusive)) {
    return "These quotes price VAT differently (inclusive vs exclusive) — make them match before merging";
  }
  return null;
}

/**
 * Lines for the merged quote, in the order the quotes were picked: each
 * source quote's lines under a heading naming it, so the customer (and
 * whoever converts it later) can still see what came from where.
 */
export function mergedQuoteLines(sources: { quote: QuoteForMerge; lines: LineForMerge[] }[]): LineForMerge[] {
  const out: LineForMerge[] = [];
  for (const { quote, lines } of sources) {
    out.push({
      itemId: null,
      description: `From ${quote.number}`,
      qty: 0,
      unitPriceCents: 0,
      discountPct: 0,
      taxClass: lines[0]?.taxClass ?? "B16",
      accountId: null,
      customColumnValue: null,
      costCenterId: null,
      warehouseId: null,
      isHeading: true,
    });
    out.push(...lines);
  }
  return out;
}

/** Combined notes, without repeating identical notes (e.g. the default terms). */
export function mergedQuoteNotes(quotes: QuoteForMerge[]): string | undefined {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const q of quotes) {
    const n = q.notes?.trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      parts.push(n);
    }
  }
  return parts.length ? parts.join("\n\n") : undefined;
}
