import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING_PACKAGES, getPricingPackage } from "../pricing-packages";

test("PRICING_PACKAGES: has the four expected module combinations at the right prices", () => {
  const byKey = Object.fromEntries(PRICING_PACKAGES.map((p) => [p.key, p]));
  assert.equal(byKey.crm.amountCents, 5_000_000);
  assert.equal(byKey.crm_accounting.amountCents, 8_000_000);
  assert.equal(byKey.crm_accounting_payroll.amountCents, 10_000_000);
  assert.equal(byKey.crm_payroll.amountCents, 7_000_000);
});

test("getPricingPackage: resolves a real key", () => {
  const pkg = getPricingPackage("crm_accounting");
  assert.equal(pkg?.label, "CRM + Accounting");
  assert.equal(pkg?.amountCents, 8_000_000);
});

test("getPricingPackage: rejects an unknown or tampered key instead of guessing a price", () => {
  assert.equal(getPricingPackage("crm_accounting_payroll_enterprise"), null);
  assert.equal(getPricingPackage(""), null);
  assert.equal(getPricingPackage(123), null);
  assert.equal(getPricingPackage(undefined), null);
});
