/**
 * Kenya tax engine — pure functions, no I/O.
 *
 * Tax classes follow eTIMS taxonomy:
 *   A_EXEMPT — exempt supplies (no VAT, input VAT not claimable)
 *   B16      — standard rate 16%
 *   C0       — zero-rated (taxable at 0%; input VAT claimable)
 *   D_NONVAT — out of scope / non-VAT
 *
 * Per-line rounding at 2dp (integer cents), which is what eTIMS validates.
 */

export type TaxClass = "A_EXEMPT" | "B16" | "C0" | "D_NONVAT";

export const TAX_CLASSES: Record<
  TaxClass,
  { label: string; rateBp: number; etimsCode: string }
> = {
  B16: { label: "VAT 16%", rateBp: 1600, etimsCode: "B" },
  C0: { label: "Zero-rated (0%)", rateBp: 0, etimsCode: "C" },
  A_EXEMPT: { label: "Exempt", rateBp: 0, etimsCode: "A" },
  D_NONVAT: { label: "Non-VAT", rateBp: 0, etimsCode: "D" },
};

export interface LineInput {
  qty: number;
  unitPriceCents: number;
  discountPct?: number; // 0-100
  taxClass: TaxClass;
}

export interface LineTotals {
  netCents: number;
  taxCents: number;
  grossCents: number;
  taxRateBp: number;
}

/** Net/VAT/gross for a line amount in the document's own pricing terms
 *  (pre-tax when exclusive, tax-included when inclusive). */
function splitAmount(raw: number, rateBp: number, taxInclusive: boolean): LineTotals {
  if (rateBp === 0) return { netCents: raw, taxCents: 0, grossCents: raw, taxRateBp: 0 };
  if (taxInclusive) {
    const net = Math.round((raw * 10000) / (10000 + rateBp));
    return { netCents: net, taxCents: raw - net, grossCents: raw, taxRateBp: rateBp };
  }
  const tax = Math.round((raw * rateBp) / 10000);
  return { netCents: raw, taxCents: tax, grossCents: raw + tax, taxRateBp: rateBp };
}

/** A line's amount after its own discount, in the document's pricing terms. */
export function lineAmount(line: LineInput): number {
  return Math.round(line.qty * line.unitPriceCents * (1 - (line.discountPct ?? 0) / 100));
}

/**
 * Compute one line.
 * Exclusive: net = qty×price −discount; tax = net×rate.
 * Inclusive: entered price contains tax; net = amount×10000/(10000+rateBp).
 */
export function computeLine(line: LineInput, taxInclusive: boolean): LineTotals {
  return splitAmount(lineAmount(line), TAX_CLASSES[line.taxClass].rateBp, taxInclusive);
}

/**
 * A discount on the whole document, on top of any per-line discounts:
 * `percent` (0–100) of the discounted lines, or a `fixed` amount in cents.
 * Both are in the document's pricing terms — before VAT on a tax-exclusive
 * document, VAT-inclusive on a tax-inclusive one — so VAT is always charged
 * on the price after the discount, as KRA requires.
 */
export type DocumentDiscount = { type: "percent" | "fixed"; value: number };

/** The discount saved on a document row, in the shape computeDocument takes. */
export function storedDiscount(doc: { discountType: string | null; discountValue: number }): DocumentDiscount | null {
  return (doc.discountType === "percent" || doc.discountType === "fixed") && doc.discountValue > 0
    ? { type: doc.discountType, value: doc.discountValue }
    : null;
}

export interface DocumentTotals {
  /** Per line, AFTER its share of the document discount — these are what get
   *  posted to the ledger and reported for VAT. */
  lines: LineTotals[];
  subtotalCents: number; // sum of nets
  taxCents: number;
  totalCents: number;
  /** Σ qty×price before any discount, in the document's pricing terms. */
  grossBeforeDiscountsCents: number;
  /** Σ per-line discounts, in the document's pricing terms. */
  lineDiscountCents: number;
  /** The whole-document discount actually applied, in the document's pricing terms. */
  documentDiscountCents: number;
  /** VAT breakdown per class for the VAT return */
  byClass: Partial<Record<TaxClass, { netCents: number; taxCents: number }>>;
}

/** The document discount in cents for a given base (Σ line amounts), never
 *  more than the base and never negative. */
export function documentDiscountAmount(discount: DocumentDiscount | null | undefined, baseCents: number): number {
  if (!discount || !(discount.value > 0) || baseCents <= 0) return 0;
  const raw = discount.type === "percent" ? Math.round((baseCents * Math.min(discount.value, 100)) / 100) : Math.round(discount.value);
  return Math.min(raw, baseCents);
}

export function computeDocument(lines: LineInput[], taxInclusive: boolean, discount?: DocumentDiscount | null): DocumentTotals {
  const out: DocumentTotals = {
    lines: [], subtotalCents: 0, taxCents: 0, totalCents: 0,
    grossBeforeDiscountsCents: 0, lineDiscountCents: 0, documentDiscountCents: 0, byClass: {},
  };
  const amounts = lines.map(lineAmount);
  for (let i = 0; i < lines.length; i++) {
    const list = Math.round(lines[i].qty * lines[i].unitPriceCents);
    out.grossBeforeDiscountsCents += list;
    out.lineDiscountCents += list - amounts[i];
  }

  // Spread the document discount across the positive lines in proportion to
  // their amounts (largest-remainder rounding, so the shares add up exactly).
  // Each line then carries its own net/VAT after the discount, so posting,
  // VAT returns and reports need no special handling.
  const positive = amounts.reduce((sum, a) => sum + Math.max(a, 0), 0);
  const total = documentDiscountAmount(discount, Math.min(positive, amounts.reduce((s, a) => s + a, 0)));
  const shares = amounts.map(() => 0);
  if (total > 0) {
    const exact = amounts.map((a) => (a > 0 ? (total * a) / positive : 0));
    let given = 0;
    exact.forEach((x, i) => { shares[i] = Math.floor(x); given += shares[i]; });
    const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((p, q) => q[0] - p[0]);
    for (let k = 0; given < total; k++, given++) shares[order[k % order.length][1]] += 1;
  }
  out.documentDiscountCents = total;

  for (let i = 0; i < lines.length; i++) {
    const t = splitAmount(amounts[i] - shares[i], TAX_CLASSES[lines[i].taxClass].rateBp, taxInclusive);
    out.lines.push(t);
    out.subtotalCents += t.netCents;
    out.taxCents += t.taxCents;
    out.totalCents += t.grossCents;
    const bucket = (out.byClass[lines[i].taxClass] ??= { netCents: 0, taxCents: 0 });
    bucket.netCents += t.netCents;
    bucket.taxCents += t.taxCents;
  }
  return out;
}

/**
 * The discount rows to show under a saved document's totals: what the lines
 * came to before any discount, the per-line discounts, and the whole-document
 * discount with its label ("Discount (10%)" / "Discount"). Recomputed from the
 * stored lines, which give back the stored totals exactly.
 */
export function discountBreakdown(
  doc: { taxInclusive: boolean; discountType: string | null; discountValue: number },
  lines: { qty: number; unitPriceCents: number; discountPct: number | null; taxClass: string; isHeading?: boolean | null }[],
) {
  const priced = lines.filter((l) => !l.isHeading).map((l) => ({ ...l, discountPct: l.discountPct ?? 0, taxClass: l.taxClass as TaxClass }));
  const discount = storedDiscount(doc);
  const t = computeDocument(priced, doc.taxInclusive, discount);
  return {
    grossBeforeDiscountsCents: t.grossBeforeDiscountsCents,
    lineDiscountCents: t.lineDiscountCents,
    documentDiscountCents: t.documentDiscountCents,
    documentDiscountLabel: discount?.type === "percent" ? `Discount (${+discount.value.toFixed(2)}%)` : "Discount",
    hasDiscount: t.lineDiscountCents > 0 || t.documentDiscountCents > 0,
  };
}

/** Common Kenyan WHT rates on payments (resident rates). */
export const WHT_RATES = [
  { label: "None", pct: 0 },
  { label: "Professional/management fees 5%", pct: 5 },
  { label: "Rent (commercial) 10%", pct: 10 },
  { label: "Dividends 5%", pct: 5 },
  { label: "Interest 15%", pct: 15 },
];
