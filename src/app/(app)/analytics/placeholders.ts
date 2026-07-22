/** Deterministic sample-shaped data for locked (blurred) cards — never real numbers. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function wave(i: number, base: number, amp: number): number {
  return Math.round(base + amp * Math.sin(i * 0.9) + amp * 0.4 * i);
}

export function fakeTrend(months: number, base = 400000, amp = 120000) {
  return Array.from({ length: months }, (_, i) => ({
    label: MONTHS[i % 12],
    a: Math.max(0, wave(i, base, amp)),
    b: Math.max(0, wave(i + 2, base * 0.7, amp * 0.8)),
  }));
}

export function fakeRanked(n: number, base = 500000) {
  const names = ["Acme Traders", "Zawadi Ltd", "Nyota Supplies", "Kilimo Hardware", "Baraka Distributors", "Mwangaza Co", "Fanaka Ventures"];
  return Array.from({ length: n }, (_, i) => ({ name: names[i % names.length], value: Math.round(base * (1 - i * 0.14)) }));
}

export function fakeBuckets() {
  return [
    { label: "Not due", value: 420000 },
    { label: "1–30d", value: 260000 },
    { label: "31–60d", value: 140000 },
    { label: "61–90d", value: 60000 },
    { label: "90d+", value: 30000 },
  ];
}

export function fakeDonut() {
  return [
    { name: "Rent", amountCents: 8000000 },
    { name: "Salaries", amountCents: 6500000 },
    { name: "Utilities", amountCents: 2200000 },
    { name: "Marketing", amountCents: 1800000 },
    { name: "Other", amountCents: 1200000 },
  ];
}

export function fakeStacked(months: number) {
  return Array.from({ length: months }, (_, i) => ({ label: MONTHS[i % 12], newC: 3 + (i % 4), returningC: 5 + (i % 3) }));
}
