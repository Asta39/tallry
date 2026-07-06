import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLine, computeDocument } from "../tax";

test("16% exclusive: 10,000.00 net → 1,600.00 VAT", () => {
  const t = computeLine({ qty: 1, unitPriceCents: 1_000_000, taxClass: "B16" }, false);
  assert.equal(t.netCents, 1_000_000);
  assert.equal(t.taxCents, 160_000);
  assert.equal(t.grossCents, 1_160_000);
});

test("16% inclusive: 1,160.00 gross → 1,000.00 net + 160.00 VAT", () => {
  const t = computeLine({ qty: 1, unitPriceCents: 116_000, taxClass: "B16" }, true);
  assert.equal(t.netCents, 100_000);
  assert.equal(t.taxCents, 16_000);
  assert.equal(t.grossCents, 116_000);
});

test("zero-rated and exempt carry no tax", () => {
  for (const cls of ["C0", "A_EXEMPT", "D_NONVAT"] as const) {
    const t = computeLine({ qty: 2, unitPriceCents: 50_000, taxClass: cls }, false);
    assert.equal(t.taxCents, 0);
    assert.equal(t.grossCents, 100_000);
  }
});

test("line discount applies before VAT", () => {
  // 4 × 250.00 = 1,000.00, 10% discount → 900.00 net, 144.00 VAT
  const t = computeLine(
    { qty: 4, unitPriceCents: 25_000, discountPct: 10, taxClass: "B16" },
    false
  );
  assert.equal(t.netCents, 90_000);
  assert.equal(t.taxCents, 14_400);
});

test("document totals sum per-line rounded tax (eTIMS style)", () => {
  // Two lines of 33.33 each at 16%: per-line tax 5.33 (rounded), total 10.66
  const d = computeDocument(
    [
      { qty: 1, unitPriceCents: 3_333, taxClass: "B16" },
      { qty: 1, unitPriceCents: 3_333, taxClass: "B16" },
    ],
    false
  );
  assert.equal(d.taxCents, 533 * 2);
  assert.equal(d.subtotalCents, 6_666);
  assert.equal(d.totalCents, 6_666 + 1_066);
});

test("VAT class breakdown accumulates", () => {
  const d = computeDocument(
    [
      { qty: 1, unitPriceCents: 100_000, taxClass: "B16" },
      { qty: 1, unitPriceCents: 50_000, taxClass: "C0" },
    ],
    false
  );
  assert.equal(d.byClass.B16?.taxCents, 16_000);
  assert.equal(d.byClass.C0?.taxCents, 0);
  assert.equal(d.byClass.C0?.netCents, 50_000);
});

test("inclusive rounding never loses a cent: net + tax = gross", () => {
  for (let cents = 1; cents < 5000; cents += 37) {
    const t = computeLine({ qty: 1, unitPriceCents: cents, taxClass: "B16" }, true);
    assert.equal(t.netCents + t.taxCents, t.grossCents, `failed at ${cents}`);
  }
});
