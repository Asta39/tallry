import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtMoney, toKesCents, fromKesCents, isForeign } from "../currency";

test("formats in the document currency", () => {
  assert.equal(fmtMoney(125_000, "USD"), "US$ 1,250.00");
  assert.equal(fmtMoney(125_000, "KES"), "KSh 1,250.00");
  assert.equal(fmtMoney(-50, "GBP"), "-£ 0.50");
  assert.equal(fmtMoney(100, null), "KSh 1.00");
});

test("converts at the document rate", () => {
  // US$ 100.00 at 129.50 = KSh 12,950.00
  assert.equal(toKesCents(10_000, 129.5), 1_295_000);
  assert.equal(fromKesCents(1_295_000, 129.5), 10_000);
  assert.equal(fromKesCents(100, 0), 0);
});

test("only known non-KES currencies are foreign", () => {
  assert.equal(isForeign("USD"), true);
  assert.equal(isForeign("KES"), false);
  assert.equal(isForeign("XYZ"), false);
  assert.equal(isForeign(null), false);
});

import { displayDocument } from "../doc-display";
import { computeDocument } from "../tax";

test("a USD invoice shows dollars while the books hold shillings", () => {
  const rate = 129.5;
  const typed = [{ qty: 2, fx: 50_000, discountPct: 0 }, { qty: 1, fx: 12_345, discountPct: 10 }];
  const lines = typed.map((l) => ({ qty: l.qty, fxUnitPriceCents: l.fx, unitPriceCents: toKesCents(l.fx, rate), discountPct: l.discountPct, taxClass: "B16" }));
  const doc = { taxInclusive: false, discountType: null, discountValue: 0, currency: "USD", fxRate: rate };
  const shown = displayDocument(doc, lines);
  // US$ 1,000 + US$ 111.11 (123.45 less 10%) = 1,111.11 net; VAT 177.78
  assert.equal(shown.currency, "USD");
  assert.equal(shown.subtotalCents, 111_111);
  assert.equal(shown.taxCents, 17_778);
  assert.equal(shown.totalCents, 128_889);
  // The books: the same document computed on the stored KES prices.
  const books = computeDocument(lines.map((l) => ({ ...l, taxClass: "B16" as const })), false);
  // Lines are converted one by one, so the books can differ from "USD total ×
  // rate" by the rounding of a few US cents (1 US cent ≈ KSh 1.30 here).
  assert.ok(Math.abs(books.totalCents - toKesCents(shown.totalCents, rate)) <= rate * 3, "KES total ≈ USD total × rate (rounding only)");
  assert.equal(shown.fromKes(toKesCents(10_000, rate)), 10_000);
});

test("a KES document shows its stored amounts unchanged", () => {
  const lines = [{ qty: 1, unitPriceCents: 1_000_000, discountPct: 0, taxClass: "B16" }];
  const shown = displayDocument({ taxInclusive: false, discountType: null, discountValue: 0 }, lines);
  assert.equal(shown.currency, "KES");
  assert.equal(shown.totalCents, 1_160_000);
});
