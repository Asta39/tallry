import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLine, computeDocument, documentDiscountAmount } from "../tax";

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

// ---------- whole-document discount ----------

test("a percentage discount on the whole invoice comes off before VAT", () => {
  // 2 × 5,000 + 1 × 10,000 = 20,000 net; 10% off → 18,000 net, VAT 2,880.
  const t = computeDocument(
    [
      { qty: 2, unitPriceCents: 500_000, taxClass: "B16" },
      { qty: 1, unitPriceCents: 1_000_000, taxClass: "B16" },
    ],
    false,
    { type: "percent", value: 10 },
  );
  assert.equal(t.grossBeforeDiscountsCents, 2_000_000);
  assert.equal(t.lineDiscountCents, 0);
  assert.equal(t.documentDiscountCents, 200_000);
  assert.equal(t.subtotalCents, 1_800_000);
  assert.equal(t.taxCents, 288_000);
  assert.equal(t.totalCents, 2_088_000);
});

test("a fixed discount is shared across lines and adds up exactly", () => {
  const t = computeDocument(
    [
      { qty: 1, unitPriceCents: 333_33, taxClass: "B16" },
      { qty: 1, unitPriceCents: 333_33, taxClass: "B16" },
      { qty: 1, unitPriceCents: 333_34, taxClass: "B16" },
    ],
    false,
    { type: "fixed", value: 100_01 },
  );
  assert.equal(t.documentDiscountCents, 100_01);
  assert.equal(t.subtotalCents, 1_000_00 - 100_01);
  assert.equal(t.lines.reduce((s, l) => s + l.netCents, 0), t.subtotalCents);
});

test("line discounts and a document discount both show and stack", () => {
  // 10,000 with 10% line discount = 9,000; then KSh 1,000 off the document.
  const t = computeDocument([{ qty: 1, unitPriceCents: 1_000_000, discountPct: 10, taxClass: "B16" }], false, { type: "fixed", value: 100_000 });
  assert.equal(t.grossBeforeDiscountsCents, 1_000_000);
  assert.equal(t.lineDiscountCents, 100_000);
  assert.equal(t.documentDiscountCents, 100_000);
  assert.equal(t.subtotalCents, 800_000);
  assert.equal(t.taxCents, 128_000);
});

test("VAT-inclusive invoices take the discount off the inclusive price", () => {
  // 11,600 incl. VAT, 10% off → 10,440 incl. = 9,000 net + 1,440 VAT.
  const t = computeDocument([{ qty: 1, unitPriceCents: 1_160_000, taxClass: "B16" }], true, { type: "percent", value: 10 });
  assert.equal(t.documentDiscountCents, 116_000);
  assert.equal(t.totalCents, 1_044_000);
  assert.equal(t.subtotalCents, 900_000);
  assert.equal(t.taxCents, 144_000);
});

test("mixed VAT classes keep VAT only on the standard-rated share", () => {
  const t = computeDocument(
    [
      { qty: 1, unitPriceCents: 1_000_000, taxClass: "B16" },
      { qty: 1, unitPriceCents: 1_000_000, taxClass: "A_EXEMPT" },
    ],
    false,
    { type: "percent", value: 20 },
  );
  assert.equal(t.byClass.B16!.netCents, 800_000);
  assert.equal(t.byClass.A_EXEMPT!.netCents, 800_000);
  assert.equal(t.taxCents, 128_000);
});

test("a document discount can't exceed the amount or go negative", () => {
  assert.equal(documentDiscountAmount({ type: "fixed", value: 5_000_00 }, 1_000_00), 1_000_00);
  assert.equal(documentDiscountAmount({ type: "percent", value: 150 }, 1_000_00), 1_000_00);
  assert.equal(documentDiscountAmount({ type: "fixed", value: -50 }, 1_000_00), 0);
  assert.equal(documentDiscountAmount(null, 1_000_00), 0);
  const t = computeDocument([{ qty: 1, unitPriceCents: 1_000_00, taxClass: "B16" }], false, { type: "fixed", value: 5_000_00 });
  assert.equal(t.totalCents, 0);
});

test("no document discount leaves totals exactly as before", () => {
  const lines = [
    { qty: 3, unitPriceCents: 199_99, discountPct: 5, taxClass: "B16" as const },
    { qty: 1, unitPriceCents: 50_00, taxClass: "C0" as const },
  ];
  const a = computeDocument(lines, false);
  const b = computeDocument(lines, false, { type: "percent", value: 0 });
  assert.deepEqual(b.lines, a.lines);
  assert.equal(a.documentDiscountCents, 0);
});
