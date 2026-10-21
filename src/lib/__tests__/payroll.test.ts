import { test } from "node:test";
import assert from "node:assert/strict";
import { runPayrollEngine, workingDaysInMonth, type RuleDef } from "../payroll";

const rules: RuleDef[] = [
  { id: 1, type: "SHIF", calculationType: "flat_percent", parametersJson: JSON.stringify({ rate: 0.0275, minCents: 30_000 }) },
  { id: 2, type: "AHL", calculationType: "flat_percent", parametersJson: JSON.stringify({ rate: 0.015 }) },
  { id: 3, type: "NSSF_TIER_I", calculationType: "banded_range", parametersJson: JSON.stringify({ rate: 0.06, lowerCents: 0, upperCents: 800_000 }) },
  {
    id: 4,
    type: "PAYE",
    calculationType: "banded",
    parametersJson: JSON.stringify({ bands: [{ upToCents: 2_400_000, rate: 0.1 }, { upToCents: 833_300, rate: 0.25 }, { rate: 0.3 }] }),
  },
  { id: 5, type: "RELIEF", calculationType: "flat_amount", parametersJson: JSON.stringify({ amountCents: 240_000 }) },
];

const base = { employeeId: 1, basicSalaryCents: 5_200_000, unpaidLeaveDays: 0, workingDaysInMonth: 26, adjustments: [], loanInstallments: [] };
const amount = (lines: ReturnType<typeof runPayrollEngine>, type: string, subType?: string) =>
  lines.filter((l) => l.type === type && (subType === undefined || l.subType === subType)).reduce((s, l) => s + l.amountCents, 0);

test("working days count Monday to Saturday", () => {
  assert.equal(workingDaysInMonth("2026-10"), 27); // 31 days, 4 Sundays
  assert.equal(workingDaysInMonth("2026-02"), 24); // 28 days, 4 Sundays
});

test("full days worked pays the full basic salary", () => {
  const lines = runPayrollEngine({ ...base, daysWorked: 26 }, rules);
  assert.equal(amount(lines, "gross_pay"), 5_200_000);
});

test("basic pay is pro-rated by days worked", () => {
  // KSh 52,000 for 20 of 26 days = KSh 40,000.
  const lines = runPayrollEngine({ ...base, daysWorked: 20 }, rules);
  assert.equal(amount(lines, "gross_pay"), 4_000_000);
  // Half days work too: 20.5 of 26 days = KSh 41,000.
  assert.equal(amount(runPayrollEngine({ ...base, daysWorked: 20.5 }, rules), "gross_pay"), 4_100_000);
});

test("statutory deductions are worked out on the pro-rated gross", () => {
  const full = runPayrollEngine({ ...base, daysWorked: 26 }, rules);
  const part = runPayrollEngine({ ...base, daysWorked: 13 }, rules);
  assert.equal(amount(part, "deduction", "SHIF"), Math.round(2_600_000 * 0.0275));
  assert.equal(amount(part, "deduction", "AHL"), Math.round(2_600_000 * 0.015));
  assert.ok(amount(part, "deduction", "PAYE") < amount(full, "deduction", "PAYE"));
  const deductions = part.filter((l) => l.type === "deduction").reduce((s, l) => s + l.amountCents, 0);
  assert.equal(amount(part, "net_pay"), 2_600_000 - deductions);
});

test("days worked override unpaid leave and are clamped to the month", () => {
  // Days worked already account for leave, so leave isn't deducted twice.
  assert.equal(amount(runPayrollEngine({ ...base, unpaidLeaveDays: 6, daysWorked: 20 }, rules), "gross_pay"), 4_000_000);
  assert.equal(amount(runPayrollEngine({ ...base, daysWorked: 40 }, rules), "gross_pay"), 5_200_000);
  assert.equal(amount(runPayrollEngine({ ...base, daysWorked: 0 }, rules), "gross_pay"), 0);
});

test("without days worked, unpaid leave still reduces pay as before", () => {
  const lines = runPayrollEngine({ ...base, unpaidLeaveDays: 2 }, rules);
  assert.equal(amount(lines, "gross_pay"), 5_200_000 - Math.floor(5_200_000 / 26) * 2);
});
