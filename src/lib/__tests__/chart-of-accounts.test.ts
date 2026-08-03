import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBalanceAdjustmentLines } from "../account-balance-adjustments";

test("buildBalanceAdjustmentLines increases an asset with a debit and offsets equity", () => {
  const [target, offset] = buildBalanceAdjustmentLines({
    accountId: 10,
    accountType: "asset",
    offsetAccountId: 3900,
    deltaCents: 12_500,
  });
  assert.deepEqual(target, { accountId: 10, debitCents: 12_500, creditCents: 0 });
  assert.deepEqual(offset, { accountId: 3900, debitCents: 0, creditCents: 12_500 });
});

test("buildBalanceAdjustmentLines reduces a liability with a debit and offsets equity", () => {
  const [target, offset] = buildBalanceAdjustmentLines({
    accountId: 20,
    accountType: "liability",
    offsetAccountId: 3900,
    deltaCents: -8_000,
  });
  assert.deepEqual(target, { accountId: 20, debitCents: 8_000, creditCents: 0 });
  assert.deepEqual(offset, { accountId: 3900, debitCents: 0, creditCents: 8_000 });
});

test("buildBalanceAdjustmentLines supports a negative asset opening balance", () => {
  const [target, offset] = buildBalanceAdjustmentLines({
    accountId: 30,
    accountType: "asset",
    offsetAccountId: 3900,
    deltaCents: -4_500,
  });
  assert.deepEqual(target, { accountId: 30, debitCents: 0, creditCents: 4_500 });
  assert.deepEqual(offset, { accountId: 3900, debitCents: 4_500, creditCents: 0 });
});
