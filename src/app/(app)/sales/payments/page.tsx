import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payments, documents, contacts } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requirePerm("invoices"); // Assuming if they can view invoices, they can view payments
  const o = await getOrg();

  const allPayments = await db
    .select({
      payment: payments,
      docNumber: documents.number,
      contactName: contacts.name,
    })
    .from(payments)
    .where(eq(payments.orgId, o.id))
    .innerJoin(documents, eq(documents.id, payments.documentId))
    .innerJoin(contacts, eq(contacts.id, documents.contactId))
    .orderBy(desc(payments.date), desc(payments.id));

  return (
    <>
      <PageHeader title="Payments Received" subtitle="All payments applied to invoices" />
      {allPayments.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No payments recorded yet. Record a payment on an open invoice to see it here.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Payment #</Th>
              <Th>Customer</Th>
              <Th>Invoice</Th>
              <Th>Method</Th>
              <Th right>Amount</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {allPayments.map((row) => (
              <tr key={row.payment.id} className="hairline-t">
                <Td className="text-[var(--color-ink-400)]">{row.payment.date}</Td>
                <Td className="font-medium text-[var(--color-ink-900)]">
                  PAY-{row.payment.id.toString().padStart(4, "0")}
                </Td>
                <Td>{row.contactName}</Td>
                <Td>
                  <Link href={`/sales/invoices/${row.payment.documentId}`} className="text-[var(--color-accent-600)] hover:underline">
                    {row.docNumber}
                  </Link>
                </Td>
                <Td className="capitalize">{row.payment.method || "—"}</Td>
                <Td right className="tnum font-medium text-[var(--color-good)]">
                  {fmtKES(row.payment.amountCents)}
                </Td>
                <Td right>
                  <Link
                    href={`/sales/payments/${row.payment.id}/print`}
                    target="_blank"
                    className="text-[12.5px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-900)]"
                  >
                    PDF Receipt
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
