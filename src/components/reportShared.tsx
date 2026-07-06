import { todayISO } from "@/lib/money";

export function periodFromSearch(sp: { from?: string; to?: string }) {
  const to = sp.to || todayISO();
  const from = sp.from || to.slice(0, 8) + "01";
  return { from, to };
}

export function PeriodPicker({ from, to, extra }: { from: string; to: string; extra?: React.ReactNode }) {
  return (
    <form className="no-print flex items-center gap-2 mb-5 text-[13px]">
      <label className="text-[var(--color-ink-600)]">From</label>
      <input type="date" name="from" defaultValue={from} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
      <label className="text-[var(--color-ink-600)]">to</label>
      <input type="date" name="to" defaultValue={to} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
      <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>
      {extra}
    </form>
  );
}

export function csvHref(report: string, from: string, to: string) {
  return `/api/export?report=${report}&from=${from}&to=${to}`;
}

export function CsvLink({ report, from, to }: { report: string; from: string; to: string }) {
  return (
    <a
      href={csvHref(report, from, to)}
      className="rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--color-ink-50)]"
    >
      Export CSV
    </a>
  );
}
