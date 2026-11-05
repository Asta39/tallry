import { computeDocument, computeLine, storedDiscount, type TaxClass } from "./tax";
import { isForeign, fromKesCents } from "./currency";

type DocLike = { taxInclusive: boolean; discountType: string | null; discountValue: number; currency?: string | null; fxRate?: number | null };
type LineLike = { qty: number; unitPriceCents: number; fxUnitPriceCents?: number | null; discountPct: number | null; taxClass: string; isHeading?: boolean | null };

/**
 * Figures to SHOW for a document, in its own currency. KES documents give
 * back exactly the stored KES amounts. Foreign ones recompute from the typed
 * foreign prices (so the customer sees round dollar figures, not converted
 * shillings converted back); the books keep the stored KES amounts.
 */
export function displayDocument(doc: DocLike, lines: LineLike[]) {
  const currency = isForeign(doc.currency) ? (doc.currency as string) : "KES";
  const rate = currency === "KES" ? 1 : Number(doc.fxRate) || 1;
  // Lines with no typed foreign price (e.g. rebilled costs added in KES) are converted at the rate.
  const price = (l: LineLike) =>
    currency === "KES" ? l.unitPriceCents : l.fxUnitPriceCents ?? fromKesCents(l.unitPriceCents, rate);
  const asLine = (l: LineLike) => ({ qty: l.qty, unitPriceCents: price(l), discountPct: l.discountPct ?? 0, taxClass: l.taxClass as TaxClass });

  let discount = storedDiscount(doc);
  if (discount?.type === "fixed" && currency !== "KES") discount = { type: "fixed", value: fromKesCents(discount.value, rate) };
  const priced = lines.filter((l) => !l.isHeading);
  const t = computeDocument(priced.map(asLine), doc.taxInclusive, discount);

  return {
    currency,
    rate,
    /** Per line, the line's own amount (the document discount is shown under the totals). */
    line: (l: LineLike) => ({ unitPriceCents: price(l), ...computeLine(asLine(l), doc.taxInclusive) }),
    subtotalCents: t.subtotalCents,
    taxCents: t.taxCents,
    totalCents: t.totalCents,
    grossBeforeDiscountsCents: t.grossBeforeDiscountsCents,
    lineDiscountCents: t.lineDiscountCents,
    documentDiscountCents: t.documentDiscountCents,
    documentDiscountLabel: discount?.type === "percent" ? `Discount (${+discount.value.toFixed(2)}%)` : "Discount",
    hasDiscount: t.lineDiscountCents > 0 || t.documentDiscountCents > 0,
    /** A KES-side amount (payments, credits, balance) in the display currency. */
    fromKes: (kesCents: number) => (currency === "KES" ? kesCents : fromKesCents(kesCents, rate)),
    byClass: t.byClass,
  };
}
