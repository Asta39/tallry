import { test } from "node:test";
import assert from "node:assert/strict";
import { canApproveSpend } from "../spend-approvals";

test("admins can approve spend regardless of accountant limit", () => {
  assert.equal(
    canApproveSpend({
      access: { isOwner: false, role: "admin" },
      totalCents: 5_000_000,
      accountantApprovalLimitCents: 30_000_00,
    }),
    true
  );
});

test("accountants can approve any spend when no limit is configured", () => {
  assert.equal(
    canApproveSpend({
      access: { isOwner: false, role: "accountant" },
      totalCents: 9_999_999,
      accountantApprovalLimitCents: null,
    }),
    true
  );
});

test("accountants are blocked above the configured approval limit", () => {
  assert.equal(
    canApproveSpend({
      access: { isOwner: false, role: "accountant" },
      totalCents: 45_000_00,
      accountantApprovalLimitCents: 30_000_00,
    }),
    false
  );
  assert.equal(
    canApproveSpend({
      access: { isOwner: false, role: "accountant" },
      totalCents: 30_000_00,
      accountantApprovalLimitCents: 30_000_00,
    }),
    true
  );
});
