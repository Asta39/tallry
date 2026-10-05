import { test } from "node:test";
import assert from "node:assert/strict";
import { parentRoute } from "../nav";

test("parentRoute goes up one level", () => {
  assert.equal(parentRoute("/sales/invoices/abc"), "/sales/invoices");
  assert.equal(parentRoute("/contacts/42"), "/contacts");
  assert.equal(parentRoute("/sales/invoices/abc/print"), "/sales/invoices/abc");
});

test("parentRoute skips section prefixes that have no page", () => {
  assert.equal(parentRoute("/sales/invoices"), "/home");
  assert.equal(parentRoute("/payroll/employees/new"), "/payroll/employees");
  assert.equal(parentRoute("/purchases/bills"), "/home");
});

test("parentRoute falls back to home at the top level", () => {
  assert.equal(parentRoute("/contacts"), "/home");
  assert.equal(parentRoute("/settings/"), "/home");
});
