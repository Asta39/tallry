import { todayISO } from "@/lib/money";

export function periodFromSearch(sp: { from?: string; to?: string }) {
  const to = sp.to || todayISO();
  const from = sp.from || to.slice(0, 8) + "01";
  return { from, to };
}

export function PeriodPicker({
  from,
  to,
  extra,
  costCenters,
  costCenter,
}: {
  from: string;
  to: string;
  extra?: React.ReactNode;
  /** When provided, adds a required Location field to the same form —
   *  reports that support cost-center filtering pass this; ones that don't
   *  (balance sheet, VAT, trial balance — see accountBalances()'s note on
   *  why) simply omit it. */
  costCenters?: { id: number; name: string }[];
  costCenter?: string;
}) {
  return (
    <form className="no-print flex items-center gap-2 mb-5 text-[13px] flex-wrap">
      {costCenters && (
        <>
          <label className="text-[var(--color-ink-600)]">Location</label>
          <select name="costCenter" defaultValue={costCenter ?? ""} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white">
            <option value="all">All locations</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </>
      )}
      <label className="text-[var(--color-ink-600)]">From</label>
      <input type="date" name="from" defaultValue={from} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
      <label className="text-[var(--color-ink-600)]">to</label>
      <input type="date" name="to" defaultValue={to} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
      <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>
      {extra}
    </form>
  );
}

/** Shown instead of the report itself until a location is explicitly
 *  picked — "All locations" counts as an explicit pick, it just isn't the
 *  default. Reused by every cost-center-aware report page. */
export function LocationGate({ costCenters }: { costCenters: { id: number; name: string }[] }) {
  return (
    <form className="no-print card p-6 max-w-sm">
      <label className="block text-[13px] font-medium text-[var(--color-ink-600)] mb-2">
        Pick a location to view this report
      </label>
      <select name="costCenter" defaultValue="" required className="w-full rounded-md border border-[var(--color-ink-200)] px-3 py-2 bg-white text-[13px] mb-3">
        <option value="" disabled>Select…</option>
        <option value="all">All locations</option>
        {costCenters.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-4 py-2 text-[13px]">Continue</button>
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

export function PdfLinks({ report, from, to, asOf, accountId, staff }: { report: string; from?: string; to?: string; asOf?: string; accountId?: string; staff?: string }) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (asOf) params.set("asOf", asOf);
  if (accountId) params.set("accountId", accountId);
  if (staff) params.set("staff", staff);

  const qs = params.toString() ? `?${params.toString()}` : "";
  const base = `/api/pdf/report/${report}${qs}`;

  return (
    <>
      <a
        href={base}
        target="_blank"
        className="rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--color-ink-50)]"
      >
        View PDF
      </a>
      <a
        href={`${base}${qs ? "&" : "?"}download=1`}
        className="rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--color-ink-50)]"
      >
        Download PDF
      </a>
    </>
  );
}
