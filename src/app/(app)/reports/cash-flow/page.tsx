import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { accountBalances } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { PdfLinks } from "@/components/reportShared";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  await requirePerm("reports");
  const sp = await searchParams;
  const asOf = sp.to || todayISO();
  const balances = await withOrg(() => accountBalances({ to: asOf }));

  // Operating: Income and Expense
  const operating = balances.filter(b => b.type === "income" || b.type === "expense");
  const opIn = operating.filter(b => b.type === "income").reduce((s, b) => s + b.balanceCents, 0);
  const opOut = operating.filter(b => b.type === "expense").reduce((s, b) => s + b.balanceCents, 0);
  const netOp = opIn - opOut;

  // Investing: Fixed Assets
  const investing = balances.filter(b => b.type === "asset" && b.subtype === "fixed_asset");
  // Assets are debit normal. An increase in asset means cash outflow.
  // Wait, if we just want a simplified cash flow, let's just group them by type.
  // We will assume net increases in assets = cash outflow (negative)
  const netInv = -investing.reduce((s, b) => s + b.balanceCents, 0);

  // Financing: Equity and Long Term Liabilities
  const financing = balances.filter(b => b.type === "equity" || b.type === "liability");
  // Liabilities & Equity are credit normal. An increase means cash inflow (positive).
  const netFin = financing.reduce((s, b) => s + b.balanceCents, 0);

  const netCash = netOp + netInv + netFin;

  const Rows = ({ title, amount }: { title: string; amount: number }) => (
    <tr className="hairline-t">
      <Td className="pl-8">{title}</Td>
      <Td right className={amount < 0 ? "text-[var(--color-bad)]" : ""}>{fmtKES(amount)}</Td>
    </tr>
  );

  return (
    <>
      <PageHeader title="Cash Flow Statement" subtitle={`Simplified cash flow as of ${asOf}`} />
      <form className="no-print flex items-center gap-2 mb-5 text-[13px]">
        <label className="text-[var(--color-ink-600)]">As of</label>
        <input type="date" name="to" defaultValue={asOf} className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 bg-white" />
        <button className="rounded-md bg-[var(--color-accent-500)] text-white font-medium px-3 py-1.5">Run</button>
        <PdfLinks report="cash-flow" asOf={asOf} />
      </form>
      <TableCard>
        <thead className="hairline-b"><tr><Th>Activity</Th><Th right>Amount</Th></tr></thead>
        <tbody>
          <tr className="bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Operating Activities</Td><Td right /></tr>
          <Rows title="Net Income / Operations" amount={netOp} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Operating Activities</Td><Td right className="font-semibold">{fmtKES(netOp)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Investing Activities</Td><Td right /></tr>
          <Rows title="Fixed Assets" amount={netInv} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Investing Activities</Td><Td right className="font-semibold">{fmtKES(netInv)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-ink-50)]/60"><Td className="font-semibold">Financing Activities</Td><Td right /></tr>
          <Rows title="Liabilities & Equity" amount={netFin} />
          <tr className="hairline-t"><Td className="font-semibold pl-8">Net Cash from Financing Activities</Td><Td right className="font-semibold">{fmtKES(netFin)}</Td></tr>

          <tr className="hairline-t bg-[var(--color-accent-50)] mt-4 border-t-2">
            <Td className="font-bold">Net Change in Cash</Td>
            <Td right className={`font-bold ${netCash < 0 ? "text-[var(--color-bad)]" : ""}`}>{fmtKES(netCash)}</Td>
          </tr>
        </tbody>
      </TableCard>
    </>
  );
}
