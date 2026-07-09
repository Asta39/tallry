import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, documents, documentLines, contacts } from "@/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function Vat3ReportPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
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
        backLink="/reports"
      />

      <div className="card mt-6 p-4">
        <form className="flex gap-4 items-end">
          <div>
            <label className="label text-sm">Select Month</label>
            <input name="month" type="month" defaultValue={month} className="input input-bordered" />
          </div>
          <button type="submit" className="btn btn-primary">Run Report</button>
        </form>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Output VAT (Sales)</h2>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Customer PIN</th>
                  <th>Customer Name</th>
                  <th>Tax Class</th>
                  <th className="text-right">Net Amount</th>
                  <th className="text-right">VAT Amount</th>
                  <th className="text-right">Gross Amount</th>
                </tr>
              </thead>
              <tbody>
                {outputData.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4">No sales data for this period.</td></tr>
                ) : (
                  outputData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.kraPin || "UNREGISTERED"}</td>
                      <td>{row.contactName || "Cash Sale"}</td>
                      <td>{row.taxClass}</td>
                      <td className="text-right">{fmtKES(Number(row.totalNet))}</td>
                      <td className="text-right">{fmtKES(Number(row.totalTax))}</td>
                      <td className="text-right">{fmtKES(Number(row.totalGross))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Input VAT (Purchases)</h2>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Vendor PIN</th>
                  <th>Vendor Name</th>
                  <th>Tax Class</th>
                  <th className="text-right">Net Amount</th>
                  <th className="text-right">VAT Amount</th>
                  <th className="text-right">Gross Amount</th>
                </tr>
              </thead>
              <tbody>
                {inputData.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4">No purchase data for this period.</td></tr>
                ) : (
                  inputData.map((row, i) => (
                    <tr key={i}>
                      <td>{row.kraPin || "UNREGISTERED"}</td>
                      <td>{row.contactName || "Cash Expense"}</td>
                      <td>{row.taxClass}</td>
                      <td className="text-right">{fmtKES(Number(row.totalNet))}</td>
                      <td className="text-right">{fmtKES(Number(row.totalTax))}</td>
                      <td className="text-right">{fmtKES(Number(row.totalGross))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
