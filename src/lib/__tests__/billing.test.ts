import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePlanAccess, subscriptionStatusForDate } from "../billing";

test("subscriptionStatusForDate marks past paid-until dates as expired", () => {
  assert.equal(subscriptionStatusForDate("2026-08-01", "2026-08-02"), "expired");
  assert.equal(subscriptionStatusForDate("2026-08-02", "2026-08-02"), "active");
});

test("resolvePlanAccess falls back expired paid plans to free entitlements", () => {
  const access = resolvePlanAccess("business", "2026-08-01", "2026-08-02");
  assert.equal(access.subscriptionPlan, "business");
  assert.equal(access.plan, "free");
  assert.equal(access.status, "expired");
  assert.equal(access.isReadOnly, true);
  assert.equal(access.limits.reporting, "basic");
  assert.equal(access.limits.portal, false);
});

test("resolvePlanAccess keeps active paid plans on their purchased entitlements", () => {
  const access = resolvePlanAccess("standard", "2026-08-31", "2026-08-02");
  assert.equal(access.subscriptionPlan, "standard");
  assert.equal(access.plan, "standard");
  assert.equal(access.status, "active");
  assert.equal(access.isReadOnly, false);
  assert.equal(access.limits.reporting, "standard");
  assert.equal(access.limits.recurring, true);
});
