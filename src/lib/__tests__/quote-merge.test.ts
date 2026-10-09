import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeQuotesError, mergedQuoteLines, mergedQuoteNotes, mergedQuoteDiscount } from "../quote-merge";

const q = (id: number, over: Partial<Parameters<typeof mergeQuotesError>[0][number]> = {}) => ({
  id,
  number: `QT-000${id}`,
  type: "quote",
  status: "open",
  contactId: 7,
  taxInclusive: false,
  notes: null,
  ...over,
});
const line = (description: string, qty = 1, unitPriceCents = 1000) => ({
  itemId: null,
  description,
  qty,
  unitPriceCents,
  discountPct: 0,
  taxClass: "B16",
  accountId: null,
  customColumnValue: null,
  costCenterId: null,
  warehouseId: null,
  isHeading: false,
});

test("two open quotes for one customer can be merged", () => {
  assert.equal(mergeQuotesError([q(1), q(2, { status: "accepted" })], 2), null);
  assert.equal(mergeQuotesError([q(1), q(2, { status: "draft" })], 2), null);
});

test("merging needs at least two quotes that all exist", () => {
  assert.match(mergeQuotesError([q(1)], 1)!, /at least two/);
  assert.match(mergeQuotesError([q(1)], 2)!, /couldn't be found/);
});

test("quotes for different customers can't be merged", () => {
  assert.match(mergeQuotesError([q(1), q(2, { contactId: 8 })], 2)!, /same customer/);
  assert.match(mergeQuotesError([q(1, { contactId: null }), q(2, { contactId: null })], 2)!, /same customer/);
});

test("converted, declined or already-merged quotes can't be merged", () => {
  for (const status of ["converted", "declined", "merged", "void"]) {
    assert.match(mergeQuotesError([q(1), q(2, { status })], 2)!, /only draft, sent or accepted/);
  }
  assert.match(mergeQuotesError([q(1), q(2, { type: "invoice" })], 2)!, /isn't a quote/);
});

test("quotes with different VAT pricing can't be merged", () => {
  assert.match(mergeQuotesError([q(1), q(2, { taxInclusive: true })], 2)!, /inclusive vs exclusive/);
});

test("merged lines keep every source line, each quote under its own heading", () => {
  const lines = mergedQuoteLines([
    { quote: q(1), lines: [line("Cement", 10, 85000), line("Sand")] },
    { quote: q(2), lines: [line("Ballast", 3, 250000)] },
  ]);
  assert.deepEqual(
    lines.map((l) => [l.description, l.isHeading, l.qty]),
    [
      ["From QT-0001", true, 0],
      ["Cement", false, 10],
      ["Sand", false, 1],
      ["From QT-0002", true, 0],
      ["Ballast", false, 3],
    ],
  );
  const total = lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0);
  assert.equal(total, 10 * 85000 + 1000 + 3 * 250000);
});

test("identical notes (e.g. default terms) appear once", () => {
  assert.equal(mergedQuoteNotes([q(1, { notes: "Valid 30 days" }), q(2, { notes: "Valid 30 days " }), q(3, { notes: "Deliver to site" })]), "Valid 30 days\n\nDeliver to site");
  assert.equal(mergedQuoteNotes([q(1), q(2, { notes: "  " })]), undefined);
});

test("merged quote keeps a shared percentage, otherwise sums the discounts", () => {
  const d = (discountType: string | null, discountValue: number, discountCents: number) => ({ discountType, discountValue, discountCents });
  assert.equal(mergedQuoteDiscount([d(null, 0, 0), d(null, 0, 0)]), null);
  assert.deepEqual(mergedQuoteDiscount([d("percent", 10, 5_000), d("percent", 10, 2_000)]), { type: "percent", value: 10 });
  assert.deepEqual(mergedQuoteDiscount([d("percent", 10, 5_000), d("percent", 5, 2_000)]), { type: "fixed", value: 7_000 });
  assert.deepEqual(mergedQuoteDiscount([d("fixed", 3_000, 3_000), d(null, 0, 0)]), { type: "fixed", value: 3_000 });
});
