import { getReceiptByToken } from "@/lib/receipts/tokens";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function PublicReceiptPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const receipt = await getReceiptByToken(token);

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ink-50,#f8fafc)] px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">🧾</div>
          <h1 className="text-lg font-semibold mb-1">Receipt not found</h1>
          <p className="text-sm text-gray-500">This link is invalid or has been revoked.</p>
        </div>
      </div>
    );
  }

  const { org, payment, doc, contact } = receipt;
  const isIn = payment.direction === "in";

  return (
    <div className="min-h-screen bg-[#f8fafc] px-4 py-10">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="text-lg font-semibold">{org.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">Official payment receipt</div>
        </div>

        <div className="px-6 py-5 space-y-3 text-sm">
          <div className="text-center py-3">
            <div className="text-3xl font-semibold tnum">{fmtKES(payment.amountCents)}</div>
            <div className="text-xs text-emerald-600 font-medium mt-1">
              {isIn ? "Payment received" : "Payment sent"}
            </div>
          </div>

          <Row label="Receipt No." value={payment.number} />
          <Row label="Date" value={payment.date} />
          {doc && <Row label={isIn ? "Invoice" : "Document"} value={doc.number} />}
          {contact && <Row label={isIn ? "Received from" : "Paid to"} value={contact.displayName} />}
          <Row label="Method" value={payment.method.toUpperCase()} />
          {payment.reference && <Row label="Reference" value={payment.reference} />}
        </div>

        <div className="px-6 pb-6">
          <a
            href={`/r/${token}/pdf?download=1`}
            className="block w-full text-center py-3 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Download PDF receipt
          </a>
        </div>
      </div>
      <div className="text-center text-[11px] text-gray-400 mt-4">
        Powered by Tallry
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
