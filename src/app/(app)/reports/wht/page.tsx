import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { withholdingTaxReport } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, CsvLink, PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function WithholdingTaxPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePerm("reports");
  const { from, to } = periodFromSearch(await searchParams);
  const wht = await withOrg(() => withholdingTaxReport(from, to));

  return (
    <>
      <PageHeader
        title="Withholding Tax Report"
        subtitle="Tax withheld by customers when settling invoices — a prepaid asset offsettable against corporate income tax."
      />
      <PeriodPicker
        from={from}
        to={to}
        extra={
          <div className="flex gap-2">
            <CsvLink report="wht" from={from} to={to} />
            <PdfLinks report="wht" from={from} to={to} />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5 max-w-2xl">
        <div className="card p-4">
          <div className="text-[11.5px] text-[var(--color-ink-500)] uppercase">Gross invoiced</div>
          <div className="text-lg font-bold mt-1">{fmtKES(wht.totalGrossCents)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11.5px] text-[var(--color-ink-500)] uppercase">Tax withheld</div>
          <div className="text-lg font-bold mt-1">{fmtKES(wht.totalWhtCents)}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11.5px] text-[var(--color-ink-500)] uppercase">Net received</div>
          <div className="text-lg font-bold mt-1">{fmtKES(wht.totalNetCents)}</div>
        </div>
      </div>

      <TableCard>
        <thead className="hairline-b">
          <tr>
            <Th>Date</Th>
            <Th>Payment #</Th>
            <Th>Invoice #</Th>
            <Th>Customer</Th>
            <Th>KRA PIN</Th>
            <Th right>Gross</Th>
            <Th right>WHT</Th>
            <Th right>Net</Th>
          </tr>
        </thead>
        <tbody>
          {wht.rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
                No withholding tax recorded for this period.
              </td>
            </tr>
          ) : (
            wht.rows.map((r, i) => (
              <tr key={i} className="hairline-t">
                <Td className="text-[var(--color-ink-500)]">{r.date}</Td>
                <Td>{r.paymentNumber}</Td>
                <Td>{r.documentNumber ?? "—"}</Td>
                <Td>{r.contactName ?? "—"}</Td>
                <Td className="text-[var(--color-ink-500)]">{r.kraPin ?? "UNREGISTERED"}</Td>
                <Td right>{fmtKES(r.grossCents)}</Td>
                <Td right>{fmtKES(r.whtCents)}</Td>
                <Td right className="font-medium">{fmtKES(r.netCents)}</Td>
              </tr>
            ))
          )}
        </tbody>
        {wht.rows.length > 0 && (
          <tfoot>
            <tr className="hairline-t bg-[var(--color-ink-50)] font-semibold">
              <td colSpan={5} className="px-4 py-3 text-[13px]">Total ({wht.rows.length})</td>
              <Td right>{fmtKES(wht.totalGrossCents)}</Td>
              <Td right>{fmtKES(wht.totalWhtCents)}</Td>
              <Td right>{fmtKES(wht.totalNetCents)}</Td>
            </tr>
          </tfoot>
        )}
      </TableCard>

      <p className="mt-4 text-[12px] text-[var(--color-ink-400)] max-w-xl">
        Figures are derived from postings to the WHT Receivable account, not from payment records directly —
        so this reconciles with your books rather than merely echoing what was typed into a payment form.
        Withholding tax you deduct when paying vendors is not yet tracked here.
      </p>
    </>
  );
}
