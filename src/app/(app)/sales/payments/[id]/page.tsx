import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payments, documents, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { fmtKES } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { getOrCreateReceiptToken, receiptUrl } from "@/lib/receipts/tokens";
import { qrPngDataUrl } from "@/lib/receipts/qr";

export const dynamic = "force-dynamic";

export default async function PaymentDetailPage(props: { params: Promise<{ id: string }> }) {
  await requirePerm("invoices");
  const o = await getOrg();
  const paymentId = Number((await props.params).id);
  if (!paymentId) notFound();

  const [row] = await db
    .select({ payment: payments, doc: documents, contact: contacts })
    .from(payments)
    .where(and(eq(payments.orgId, o.id), eq(payments.id, paymentId)))
    .leftJoin(documents, eq(documents.id, payments.documentId))
    .leftJoin(contacts, eq(contacts.id, payments.contactId))
    .limit(1);
  if (!row) notFound();

  const { payment, doc, contact } = row;
  const isIn = payment.direction === "in";

  const token = isIn
    ? await getOrCreateReceiptToken(o.id, payment.id).catch(() => null)
    : null;
  const publicUrl = token ? await receiptUrl(token) : null;
  const qr = publicUrl ? await qrPngDataUrl(publicUrl).catch(() => null) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={payment.number}
        subtitle={isIn ? "Payment received" : "Payment sent"}
        action={
          <div className="flex gap-2">
            <a
              href={`/api/payment-receipt/pdf/${payment.id}`}
              target="_blank"
              className="px-3 py-2 rounded-lg border border-[var(--color-ink-200)] text-[12.5px] font-medium hover:bg-[var(--color-ink-50)]"
            >
              View PDF
            </a>
            <a
              href={`/api/payment-receipt/pdf/${payment.id}?download=1`}
              className="px-3 py-2 rounded-lg bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] text-white text-[12.5px] font-medium"
            >
              Download PDF
            </a>
          </div>
        }
      />

      <div className="card px-6 py-6">
        <div className="text-center pb-5 hairline-b">
          <div className="text-3xl font-semibold tnum">{fmtKES(payment.amountCents)}</div>
          <div className={`text-[12px] font-medium mt-1 ${isIn ? "text-emerald-600" : "text-[var(--color-ink-500)]"}`}>
            {isIn ? "received" : "paid out"} · {payment.date}
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 pt-5 text-[13px]">
          <Item label={isIn ? "Received from" : "Paid to"}>
            {contact ? (
              <Link href={`/contacts/${contact.id}`} className="text-[var(--color-accent-600)] hover:underline">
                {contact.displayName}
              </Link>
            ) : "—"}
          </Item>
          <Item label={doc?.type === "invoice" ? "Invoice" : "Document"}>
            {doc ? (
              <Link
                href={doc.type === "invoice" ? `/sales/invoices/${doc.id}` : `/purchases/bills/${doc.id}`}
                className="text-[var(--color-accent-600)] hover:underline"
              >
                {doc.number}
              </Link>
            ) : "—"}
          </Item>
          <Item label="Method"><span className="capitalize">{payment.method || "—"}</span></Item>
          <Item label="Reference">{payment.reference || "—"}</Item>
          {payment.whtCents > 0 && <Item label="Withholding tax">{fmtKES(payment.whtCents)}</Item>}
          <Item label="Print view">
            <Link href={`/sales/payments/${payment.id}/print`} className="text-[var(--color-accent-600)] hover:underline">
              Open printable receipt
            </Link>
          </Item>
        </dl>
      </div>

      {publicUrl && qr && (
        <div className="card px-6 py-5 mt-4 flex items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Receipt QR" className="w-24 h-24 rounded-lg border border-[var(--color-ink-200)]" />
          <div className="min-w-0">
            <div className="text-[13px] font-medium">Customer receipt link</div>
            <p className="text-[12px] text-[var(--color-ink-500)] mt-0.5">
              Anyone with this link can view and download the receipt — share it or let the customer scan the QR.
            </p>
            <a href={publicUrl} target="_blank" className="text-[12.5px] text-[var(--color-accent-600)] hover:underline break-all">
              {publicUrl}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--color-ink-400)] mb-0.5">{label}</dt>
      <dd className="font-medium text-[var(--color-ink-900)]">{children}</dd>
    </div>
  );
}
