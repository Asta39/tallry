import { requirePerm } from "@/lib/guard";
import { withOrg } from "@/lib/org";
import { vat3Prefill, type Vat3Row } from "@/lib/reports";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES, todayISO } from "@/lib/money";
import { PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

/** Last day of a YYYY-MM month, as YYYY-MM-DD. */
function monthEnd(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default async function Vat3ReportPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requirePerm("reports");

  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "")
    ? searchParams.month!
    : todayISO().slice(0, 7);
  const startDate = `${month}-01`;
  const endDate = monthEnd(month);

  const { output, input } = await withOrg(() => vat3Prefill(startDate, endDate));

  return (
    <>
      <PageHeader
        title="iTax VAT3 Prefill"
        subtitle={`Generate data for the KRA VAT return upload for ${month}`}
      />

      <form className="card p-5 mt-6 mb-8 no-print flex flex-wrap gap-4 items-end">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Select month</span>
          <input
            name="month"
            type="month"
            defaultValue={month}
            className="mt-1 block rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-5 py-2.5 transition-colors"
        >
          Run Report
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <PdfLinks report="vat3" from={startDate} to={endDate} />
        </div>
      </form>

      <Section
        title="Output VAT (Sales)"
        rows={output}
        pinLabel="Customer PIN"
        nameLabel="Customer Name"
        fallbackName="Cash Sale"
        emptyText="No sales data for this period."
      />

      <Section
        title="Input VAT (Purchases)"
        rows={input}
        pinLabel="Vendor PIN"
        nameLabel="Vendor Name"
        fallbackName="Cash Expense"
        emptyText="No purchase data for this period."
      />
    </>
  );
}

function Section({
  title,
  rows,
  pinLabel,
  nameLabel,
  fallbackName,
  emptyText,
}: {
  title: string;
  rows: Vat3Row[];
  pinLabel: string;
  nameLabel: string;
  fallbackName: string;
  emptyText: string;
}) {
  const totals = rows.reduce(
    (a, r) => ({
      net: a.net + r.netCents,
      tax: a.tax + r.taxCents,
      gross: a.gross + r.grossCents,
    }),
    { net: 0, tax: 0, gross: 0 }
  );

  return (
    <div className="mt-8">
      <h2 className="text-[15px] font-semibold mb-3">{title}</h2>
      <TableCard>
        <thead className="hairline-b">
          <tr>
            <Th>{pinLabel}</Th>
            <Th>{nameLabel}</Th>
            <Th>Tax Class</Th>
            <Th right>Net Amount</Th>
            <Th right>VAT Amount</Th>
            <Th right>Gross Amount</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-8 text-[var(--color-ink-500)] text-[13px]">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td>{row.kraPin || "UNREGISTERED"}</Td>
                <Td>{row.contactName || fallbackName}</Td>
                <Td>{row.taxClass}</Td>
                <Td right>{fmtKES(row.netCents)}</Td>
                <Td right>{fmtKES(row.taxCents)}</Td>
                <Td right className="font-medium">{fmtKES(row.grossCents)}</Td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="hairline-t bg-[var(--color-ink-50)] font-semibold">
              <Td>Total</Td>
              <Td />
              <Td />
              <Td right>{fmtKES(totals.net)}</Td>
              <Td right>{fmtKES(totals.tax)}</Td>
              <Td right>{fmtKES(totals.gross)}</Td>
            </tr>
          </tfoot>
        )}
      </TableCard>
    </div>
  );
}
