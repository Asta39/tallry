import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, documents, documentLines, contacts } from "@/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Vat3ReportPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  await requirePerm("reports");
  const o = await getOrg();

  const month = searchParams.month || new Date().toISOString().slice(0, 7);
  const startDate = `${month}-01`;
  const endDate = new Date(Number(month.split("-")[0]), Number(month.split("-")[1]), 0).toISOString().slice(0, 10);

  // Output VAT (Sales: Invoices)
  const outputData = await db
    .select({
      taxClass: documentLines.taxClass,
      kraPin: contacts.kraPin,
      contactName: contacts.displayName,
      totalGross: sql<number>`sum(${documentLines.grossCents})`,
      totalTax: sql<number>`sum(${documentLines.taxCents})`,
      totalNet: sql<number>`sum(${documentLines.netCents})`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, o.id),
        eq(documents.type, "invoice"),
        eq(documents.status, "open"), // or partial/paid/closed
        gte(documents.date, startDate),
        lte(documents.date, endDate)
      )
    )
    .groupBy(documentLines.taxClass, contacts.kraPin, contacts.displayName);

  // Input VAT (Purchases: Bills, Expenses)
  const inputData = await db
    .select({
      taxClass: documentLines.taxClass,
      kraPin: contacts.kraPin,
      contactName: contacts.displayName,
      totalGross: sql<number>`sum(${documentLines.grossCents})`,
      totalTax: sql<number>`sum(${documentLines.taxCents})`,
      totalNet: sql<number>`sum(${documentLines.netCents})`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, o.id),
        sql`${documents.type} IN ('bill', 'expense')`,
        gte(documents.date, startDate),
        lte(documents.date, endDate)
      )
    )
    .groupBy(documentLines.taxClass, contacts.kraPin, contacts.displayName);

  return (
    <>
      <PageHeader 
        title="iTax VAT3 Prefill" 
        subtitle={`Generate data for the KRA VAT return upload for ${month}`}
      />

      <div className="card bg-base-100 shadow-sm border border-base-content/10 p-5 mt-6">
        <form className="flex gap-4 items-end">
          <div>
            <label className="label text-sm font-medium">Select Month</label>
            <input name="month" type="month" defaultValue={month} className="input input-bordered w-full max-w-xs" />
          </div>
          <button type="submit" className="btn btn-primary">Run Report</button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Output VAT (Sales)</h2>
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Customer PIN</Th>
              <Th>Customer Name</Th>
              <Th>Tax Class</Th>
              <Th right>Net Amount</Th>
              <Th right>VAT Amount</Th>
              <Th right>Gross Amount</Th>
            </tr>
          </thead>
          <tbody>
            {outputData.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[var(--color-ink-500)] text-[13px]">No sales data for this period.</td></tr>
            ) : (
              outputData.map((row, i) => (
                <tr key={i} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                  <Td>{row.kraPin || "UNREGISTERED"}</Td>
                  <Td>{row.contactName || "Cash Sale"}</Td>
                  <Td>{row.taxClass}</Td>
                  <Td right>{fmtKES(Number(row.totalNet) || 0)}</Td>
                  <Td right>{fmtKES(Number(row.totalTax) || 0)}</Td>
                  <Td right className="font-medium">{fmtKES(Number(row.totalGross) || 0)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Input VAT (Purchases)</h2>
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Vendor PIN</Th>
              <Th>Vendor Name</Th>
              <Th>Tax Class</Th>
              <Th right>Net Amount</Th>
              <Th right>VAT Amount</Th>
              <Th right>Gross Amount</Th>
            </tr>
          </thead>
          <tbody>
            {inputData.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[var(--color-ink-500)] text-[13px]">No purchase data for this period.</td></tr>
            ) : (
              inputData.map((row, i) => (
                <tr key={i} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                  <Td>{row.kraPin || "UNREGISTERED"}</Td>
                  <Td>{row.contactName || "Cash Expense"}</Td>
                  <Td>{row.taxClass}</Td>
                  <Td right>{fmtKES(Number(row.totalNet) || 0)}</Td>
                  <Td right>{fmtKES(Number(row.totalTax) || 0)}</Td>
                  <Td right className="font-medium">{fmtKES(Number(row.totalGross) || 0)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableCard>
      </div>
    </>
  );
}
