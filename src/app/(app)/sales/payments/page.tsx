import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payments, documents, contacts, paymentEvents } from "@/db";
import { eq, and, desc, inArray, count } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePerm("invoices"); // Assuming if they can view invoices, they can view payments
  const o = await getOrg();
  const { tab } = await searchParams;
  // Previously this page joined `payments` -> `documents` with no direction
  // filter, so vendor bill payments (direction "out") showed up mixed into
  // "Payments Received" — mislabeled and colored green like money in. Split
  // into two explicit tabs, each filtered by payments.direction.
  const direction: "in" | "out" = tab === "made" ? "out" : "in";

  const rows = await db
    .select({
      payment: payments,
      docNumber: documents.number,
      docType: documents.type,
      contactName: contacts.displayName,
    })
    .from(payments)
    .where(and(eq(payments.orgId, o.id), eq(payments.direction, direction)))
    // Left join: expense-claim reimbursements aren't linked to a `documents`
    // row at all (they settle a liability account, not an invoice/bill), so
    // an inner join here silently dropped every one of them from this list.
    .leftJoin(documents, eq(documents.id, payments.documentId))
    .leftJoin(contacts, eq(contacts.id, documents.contactId))
    .orderBy(desc(payments.date), desc(payments.id));

  const [{ pending }] = await db.select({ pending: count() }).from(paymentEvents)
    .where(and(
      eq(paymentEvents.orgId, o.id),
      eq(paymentEvents.direction, "in"),
      inArray(paymentEvents.status, ["unmatched", "amount_mismatch", "received", "failed", "pending"]),
    ));

  return (
    <>
      <PageHeader
        title={direction === "in" ? "Payments Received" : "Payments Made"}
        subtitle={direction === "in" ? "Money in — payments applied to invoices" : "Money out — payments applied to bills and expense claims"}
        action={
          <Link
            href="/sales/payments/events"
            className={`text-[12.5px] font-medium px-3 py-2 rounded-lg border ${pending > 0
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-[var(--color-ink-200)] text-[var(--color-ink-500)] hover:bg-[var(--color-ink-50)]"}`}
          >
            Gateway events{pending > 0 ? ` · ${pending} to review` : ""}
          </Link>
        }
      />

      <div className="flex gap-4 border-b border-[var(--color-ink-200)] mb-5">
        <Link
          href="/sales/payments?tab=received"
          className={`pb-3 text-[13.5px] font-medium transition-colors ${direction === "in" ? "text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"}`}
        >
          Received
        </Link>
        <Link
          href="/sales/payments?tab=made"
          className={`pb-3 text-[13.5px] font-medium transition-colors ${direction === "out" ? "text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]" : "text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)]"}`}
        >
          Made
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          {direction === "in" ? "No payments recorded yet. Record a payment on an open invoice to see it here." : "No payments made yet."}
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Payment #</Th>
              <Th>{direction === "in" ? "Customer" : "Vendor / Payee"}</Th>
              <Th>{direction === "in" ? "Invoice" : "Bill"}</Th>
              <Th>Method</Th>
              <Th right>Amount</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.payment.id} className="hairline-t">
                <Td className="text-[var(--color-ink-400)]">{row.payment.date}</Td>
                <Td className="font-medium">
                  <Link href={`/sales/payments/${row.payment.id}`} className="text-[var(--color-accent-600)] hover:underline">
                    PAY-{row.payment.id.toString().padStart(4, "0")}
                  </Link>
                </Td>
                <Td>{row.contactName || (row.payment.reference?.startsWith("Expense claim") ? "Expense claim" : "—")}</Td>
                <Td>
                  {row.docNumber ? (
                    <Link href={`/${row.docType === "bill" ? "purchases/bills" : "sales/invoices"}/${row.payment.documentId}`} className="text-[var(--color-accent-600)] hover:underline">
                      {row.docNumber}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-ink-400)]" title={row.payment.reference || undefined}>
                      {row.payment.reference || "—"}
                    </span>
                  )}
                </Td>
                <Td className="capitalize">{row.payment.method || "—"}</Td>
                <Td right className={`tnum font-medium ${direction === "in" ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}>
                  {direction === "in" ? "+" : "-"}{fmtKES(row.payment.amountCents)}
                </Td>
                <Td right>
                  {row.docNumber ? (
                    <Link
                      href={`/sales/payments/${row.payment.id}/print`}
                      target="_blank"
                      className="text-[12.5px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-900)]"
                    >
                      PDF Receipt
                    </Link>
                  ) : (
                    <Link
                      href={`/sales/payments/${row.payment.id}`}
                      className="text-[12.5px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-900)]"
                    >
                      Details
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
