import { withOrg } from "@/lib/org";
import { vatReturn } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PeriodPicker, periodFromSearch, CsvLink } from "@/components/reportShared";

export const dynamic = "force-dynamic";

const classLabels: Record<string, string> = {
  B16: "Standard rate 16%",
  C0: "Zero-rated 0%",
  A_EXEMPT: "Exempt",
  D_NONVAT: "Non-VAT",
};

export default async function VatPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = periodFromSearch(await searchParams);
  const v = await withOrg(() => vatReturn(from, to));

  const Block = ({ title, data }: { title: string; data: typeof v.sales }) => (
    <TableCard>
      <thead className="hairline-b">
        <tr><Th>{title}</Th><Th right>Taxable value</Th><Th right>VAT</Th></tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([cls, x]) => (
          <tr key={cls} className="hairline-t">
            <Td>{classLabels[cls]}</Td>
            <Td right>{fmtKES(x.net)}</Td>
            <Td right>{fmtKES(x.tax)}</Td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );

  return (
    <>
      <PageHeader
        title="VAT Return prep (VAT 3)"
        subtitle="File by the 20th of the following month on iTax. Numbers must match your eTIMS transmissions."
      />
      <PeriodPicker from={from} to={to} extra={<CsvLink report="vat" from={from} to={to} />} />

      <div className="grid grid-cols-2 gap-5">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-2">Sales (Output VAT)</h2>
          <Block title="Supplies" data={v.sales} />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-2">Purchases (Input VAT)</h2>
          <Block title="Purchases" data={v.purchases} />
        </div>
      </div>

      <div className="card mt-5 px-6 py-5 max-w-md">
        <div className="flex justify-between py-1 text-[13px]">
          <span>Output VAT (on your sales)</span><span className="tnum">{fmtKES(v.outputVat)}</span>
        </div>
        <div className="flex justify-between py-1 text-[13px]">
          <span>Less: Input VAT (on purchases)</span><span className="tnum">−{fmtKES(v.inputVat)}</span>
        </div>
        <div className="hairline-t mt-2 pt-2 flex justify-between font-bold text-[15px]">
          <span>{v.netVatDue >= 0 ? "VAT payable to KRA" : "VAT credit carried forward"}</span>
          <span className={`tnum ${v.netVatDue >= 0 ? "text-[var(--color-warn)]" : "text-[var(--color-good)]"}`}>
            {fmtKES(Math.abs(v.netVatDue))}
          </span>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-[var(--color-ink-400)] max-w-xl">
        Input VAT on exempt supplies is not claimable and is excluded. Zero-rated sales are taxable at 0% —
        you still declare them and can claim related input VAT.
      </p>
    </>
  );
}
