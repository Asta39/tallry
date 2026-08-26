import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBillingAccess, addDaysISO, addMonthsISO } from "../billing";

test("resolveBillingAccess: trial within window stays trial with days remaining", () => {
  const access = resolveBillingAccess(
    { billingStatus: "trial", trialEndsAt: "2026-08-09", activatedAt: null, monthlyFeeCents: 0, nextMaintenanceDueAt: null },
    "2026-08-02"
  );
  assert.equal(access.status, "trial");
  assert.equal(access.trialDaysLeft, 7);
});

test("resolveBillingAccess: trial past its end date locks", () => {
  const access = resolveBillingAccess(
    { billingStatus: "trial", trialEndsAt: "2026-08-01", activatedAt: null, monthlyFeeCents: 0, nextMaintenanceDueAt: null },
    "2026-08-02"
  );
  assert.equal(access.status, "locked");
  assert.equal(access.trialDaysLeft, 0);
});

test("resolveBillingAccess: active status is always full access regardless of due date", () => {
  const access = resolveBillingAccess(
    { billingStatus: "active", trialEndsAt: "2026-01-01", activatedAt: "2026-01-01", monthlyFeeCents: 500000, nextMaintenanceDueAt: "2026-07-01" },
    "2026-08-02"
  );
  assert.equal(access.status, "active");
  assert.equal(access.monthlyFeeCents, 500000);
});

test("resolveBillingAccess: suspended always locks regardless of dates", () => {
  const access = resolveBillingAccess(
    { billingStatus: "suspended", trialEndsAt: "2026-01-01", activatedAt: "2026-01-01", monthlyFeeCents: 500000, nextMaintenanceDueAt: "9999-01-01" },
    "2026-08-02"
  );
  assert.equal(access.status, "locked");
});

test("addDaysISO / addMonthsISO advance dates correctly", () => {
  assert.equal(addDaysISO("2026-08-02", 7), "2026-08-09");
  assert.equal(addMonthsISO("2026-08-02", 1), "2026-09-02");
});
