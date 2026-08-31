import { test, describe } from "node:test";
import assert from "node:assert";
import { advance, dueRuns, addDays, endOfMonthISO } from "../recurring";

describe("Recurring Logic", () => {
  test("advances monthly dates correctly", () => {
    assert.strictEqual(advance("2024-01-31", "monthly"), "2024-02-29"); // leap year
    assert.strictEqual(advance("2023-01-31", "monthly"), "2023-02-28"); // non-leap year
    assert.strictEqual(advance("2024-03-31", "monthly"), "2024-04-30"); // clamps to end of month
    assert.strictEqual(advance("2024-12-15", "monthly"), "2025-01-15"); // cross year
  });

  test("a month-end anchor stays anchored to month-end forever, not just min(day, lastDay)", () => {
    // Old buggy behavior: Mar 31 -> Apr 30 (correctly clamped) -> May 30
    // (WRONG — carried the clamped "30" forward instead of re-anchoring to
    // May's actual last day, 31). A template meant to run "on the last day
    // of every month" would silently stop landing on the 31st forever after
    // the first 30-day month it crossed.
    let d = "2024-01-31";
    d = advance(d, "monthly"); assert.strictEqual(d, "2024-02-29"); // leap Feb
    d = advance(d, "monthly"); assert.strictEqual(d, "2024-03-31"); // springs back to 31
    d = advance(d, "monthly"); assert.strictEqual(d, "2024-04-30");
    d = advance(d, "monthly"); assert.strictEqual(d, "2024-05-31"); // springs back to 31 again
  });

  test("endOfMonthISO returns the last calendar day of the month", () => {
    assert.strictEqual(endOfMonthISO("2026-08-05"), "2026-08-31");
    assert.strictEqual(endOfMonthISO("2026-02-01"), "2026-02-28");
    assert.strictEqual(endOfMonthISO("2024-02-15"), "2024-02-29"); // leap year
  });

  test("advances yearly dates correctly", () => {
    assert.strictEqual(advance("2024-02-29", "yearly"), "2025-02-28"); // leap to non-leap
    assert.strictEqual(advance("2023-05-15", "yearly"), "2024-05-15");
  });

  test("calculates due runs", () => {
    const runs = dueRuns("2024-01-01", "monthly", "2024-03-10");
    assert.deepStrictEqual(runs, ["2024-01-01", "2024-02-01", "2024-03-01"]);
  });

  test("caps due runs", () => {
    const runs = dueRuns("2020-01-01", "monthly", "2024-01-01", 12);
    assert.strictEqual(runs.length, 12);
  });

  test("adds days correctly", () => {
    assert.strictEqual(addDays("2024-02-28", 1), "2024-02-29");
    assert.strictEqual(addDays("2024-02-29", 1), "2024-03-01");
  });
});
