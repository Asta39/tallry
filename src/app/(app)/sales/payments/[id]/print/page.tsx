import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payments, documents, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PrintPaymentReceipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePerm("invoices");
  const o = await getOrg();
  const paymentId = Number((await params).id);
  if (!paymentId) notFound();

  const [row] = await db
    .select({
      payment: payments,
      doc: documents,
      contact: contacts,
    })
    .from(payments)
    .where(and(eq(payments.orgId, o.id), eq(payments.id, paymentId)))
    .innerJoin(documents, eq(documents.id, payments.documentId))
    .innerJoin(contacts, eq(contacts.id, documents.contactId))
    .limit(1);

  if (!row) notFound();

  return (
    <div className="fixed inset-0 bg-white overflow-auto z-50">
      <div className="max-w-[720px] mx-auto px-10 py-10 text-[13px] text-black">
        <div className="no-print mb-6 flex gap-3">
          <a href="/sales/payments" className="text-[13px] underline">← Back to Payments</a>
          <a href={`/api/payment-receipt/pdf/${row.payment.id}?download=1`} className="text-[13px] font-medium text-blue-600 hover:underline">
            Download PDF
          </a>
          <span className="text-[13px] text-gray-500">Use your browser's Print (⌘P) to print</span>
        </div>

        <div className="flex justify-between items-start mb-12">
          <div>
            {o.logoUrl && <img src={o.logoUrl} alt={o.name} className="max-w-[220px] max-h-[90px] mb-6 object-contain" />}
            <h2 className="text-xl font-bold">{o.name}</h2>
            <div className="text-[13px] text-gray-500 whitespace-pre-wrap mt-1">
            {o.address}
            {o.kraPin ? `\nPIN: ${o.kraPin}` : ""}
            {o.vatRegistered ? "\nVAT Registered" : ""}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-light tracking-tight text-[var(--color-brand,#0f766e)] mb-2 uppercase">
            Receipt
          </h1>
          <div className="text-[13px] text-gray-500">
            Receipt #: PAY-{row.payment.id.toString().padStart(4, "0")}
            <br />
            Date: {row.payment.date}
          </div>
        </div>
      </div>

      <div className="flex justify-between mb-12">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Received From
          </div>
          <div className="font-semibold text-[14px]">{row.contact.displayName}</div>
        </div>
      </div>

      <table className="w-full text-[13px] mb-12">
        <thead className="border-b-2 border-black">
          <tr>
            <th className="py-2 px-1 text-left font-semibold text-gray-600">Payment Date</th>
            <th className="py-2 px-1 text-left font-semibold text-gray-600">Reference Number</th>
            <th className="py-2 px-1 text-left font-semibold text-gray-600">Payment Mode</th>
            <th className="py-2 px-1 text-right font-semibold text-gray-600">Amount Received</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-3 px-1">{row.payment.date}</td>
            <td className="py-3 px-1">{row.payment.reference || "—"}</td>
            <td className="py-3 px-1 capitalize">{row.payment.method || "—"}</td>
            <td className="py-3 px-1 text-right font-medium tnum">{fmtKES(row.payment.amountCents)}</td>
          </tr>
        </tbody>
      </table>

      <div className="border-t border-gray-200 pt-8 mt-12 text-[12px] text-gray-400">
        <p>This is a payment receipt for Invoice #{row.doc.number}.</p>
      </div>
    </div>
    </div>
  );
}
