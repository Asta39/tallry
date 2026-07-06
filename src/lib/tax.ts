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

/**
 * Compute one line.
 * Exclusive: net = qty×price −discount; tax = net×rate.
 * Inclusive: entered price contains tax; net = amount×10000/(10000+rateBp).
 */
export function computeLine(line: LineInput, taxInclusive: boolean): LineTotals {
  const rateBp = TAX_CLASSES[line.taxClass].rateBp;
  const discount = 1 - (line.discountPct ?? 0) / 100;
  const raw = Math.round(line.qty * line.unitPriceCents * discount);

  if (rateBp === 0) return { netCents: raw, taxCents: 0, grossCents: raw, taxRateBp: 0 };

  if (taxInclusive) {
    const net = Math.round((raw * 10000) / (10000 + rateBp));
    return { netCents: net, taxCents: raw - net, grossCents: raw, taxRateBp: rateBp };
  }
  const tax = Math.round((raw * rateBp) / 10000);
  return { netCents: raw, taxCents: tax, grossCents: raw + tax, taxRateBp: rateBp };
}

export interface DocumentTotals {
  lines: LineTotals[];
  subtotalCents: number; // sum of nets
  taxCents: number;
  totalCents: number;
  /** VAT breakdown per class for the VAT return */
  byClass: Partial<Record<TaxClass, { netCents: number; taxCents: number }>>;
}

export function computeDocument(lines: LineInput[], taxInclusive: boolean): DocumentTotals {
  const out: DocumentTotals = { lines: [], subtotalCents: 0, taxCents: 0, totalCents: 0, byClass: {} };
  for (const l of lines) {
    const t = computeLine(l, taxInclusive);
    out.lines.push(t);
    out.subtotalCents += t.netCents;
    out.taxCents += t.taxCents;
    out.totalCents += t.grossCents;
    const bucket = (out.byClass[l.taxClass] ??= { netCents: 0, taxCents: 0 });
    bucket.netCents += t.netCents;
    bucket.taxCents += t.taxCents;
  }
  return out;
}

/** Common Kenyan WHT rates on payments (resident rates). */
export const WHT_RATES = [
  { label: "None", pct: 0 },
  { label: "Professional/management fees 5%", pct: 5 },
  { label: "Rent (commercial) 10%", pct: 10 },
  { label: "Dividends 5%", pct: 5 },
  { label: "Interest 15%", pct: 15 },
];
