import { test } from "node:test";
import assert from "node:assert/strict";
import { withholdingVatDueCents, remainingWithholdingCents } from "../wht";

test("withholding VAT is 2% of the VAT-able lines' net only", () => {
  // Shape of a real receipt (Luna Graphics INV-2176): 16% lines netting
  // KSh 118,730.08 plus non-VAT lines; the customer withheld KSh 2,374.60.
  const lines = [
    { netCents: 10_000_000, taxRateBp: 1600 },
    { netCents: 1_873_008, taxRateBp: 1600 },
    { netCents: 1_170_000, taxRateBp: 0 },
  ];
  assert.equal(withholdingVatDueCents(lines), 237_460);
  assert.equal(withholdingVatDueCents([{ netCents: 5_000_000, taxRateBp: 0 }]), 0);
  assert.equal(withholdingVatDueCents([]), 0);
});

test("remaining WHT nets off what earlier payments already withheld", () => {
  assert.equal(remainingWithholdingCents(193_057, 0), 193_057);
  assert.equal(remainingWithholdingCents(193_057, 100_000), 93_057);
  assert.equal(remainingWithholdingCents(193_057, 193_094), 0); // customer rounded up — never negative
});
