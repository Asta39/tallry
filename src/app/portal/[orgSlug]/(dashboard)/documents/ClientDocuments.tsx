"use client";

import { useState, useTransition } from "react";
import { portalRequestPaymentAction } from "./actions";
import { StatusPill, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";

export function ClientDocuments({
  slug,
  documents,
  payments,
}: {
  slug: string;
  documents: any[];
  payments: any[];
}) {
  const [payDoc, setPayDoc] = useState<any | null>(null);
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!phone) return setError("Phone number is required");

    start(async () => {
      try {
        const res = await portalRequestPaymentAction(slug, payDoc.id, phone);
        if (res.error) setError(res.error);
        else {
          setSuccess("Check your phone for the M-Pesa pin prompt!");
          setTimeout(() => {
            setPayDoc(null);
            setSuccess(null);
          }, 5000);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred");
      }
    });
  };

  return (
    <>
      <TableCard>
        <thead className="hairline-b">
          <tr>
            <Th>Date</Th>
            <Th>Number</Th>
            <Th>Status</Th>
            <Th right>Total</Th>
            <Th right>Balance</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="hairline-t">
              <Td className="text-[var(--color-ink-500)]">{d.date}</Td>
              <Td className="font-medium capitalize">{d.type} {d.number}</Td>
              <Td><StatusPill status={d.status} /></Td>
              <Td right>{fmtKES(d.totalCents)}</Td>
              <Td right className="font-medium">
                {d.type === "invoice" && ["open", "partial"].includes(d.status) ? fmtKES(d.totalCents - d.paidCents) : "—"}
              </Td>
              <Td right>
                <div className="flex justify-end gap-2">
                  {d.type === "invoice" && ["open", "partial"].includes(d.status) && (
                    <button
                      onClick={() => { setPayDoc(d); setPhone(""); setError(null); setSuccess(null); }}
                      className="px-3 py-1 bg-[var(--color-brand)] text-white text-[12px] font-semibold rounded-md shadow-sm hover:opacity-90 transition-all"
                    >
                      Pay Now
                    </button>
                  )}
                  <a
                    href={`/api/pdf/${d.id}`}
                    target="_blank"
                    className="px-3 py-1 border border-[var(--color-ink-200)] text-[12px] font-medium text-[var(--color-ink-700)] rounded-md hover:bg-[var(--color-ink-50)] transition-all"
                  >
                    Download PDF
                  </a>
                </div>
              </Td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-10 text-[13px] text-[var(--color-ink-400)]">
                No documents found.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>

      {/* Payment Modal */}
      {payDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-1 text-[var(--color-ink-900)]">Pay Invoice {payDoc.number}</h3>
            <p className="text-[13.5px] text-[var(--color-ink-600)] mb-5">
              Enter your M-Pesa number to pay {fmtKES(payDoc.totalCents - payDoc.paidCents)}.
            </p>

            <form onSubmit={handlePay} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[var(--color-ink-900)] mb-1">M-Pesa Phone Number</label>
                <input
                  type="text"
                  placeholder="2547..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--color-ink-200)] rounded-lg text-[14px] focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none transition-all"
                />
              </div>

              {error && <div className="text-[13px] text-[var(--color-bad)] font-medium bg-[var(--color-bad)]/10 p-3 rounded-lg">{error}</div>}
              {success && <div className="text-[13px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 p-3 rounded-lg">{success}</div>}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPayDoc(null)}
                  className="px-4 py-2 border border-[var(--color-ink-200)] text-[var(--color-ink-700)] text-[13px] font-medium rounded-lg hover:bg-[var(--color-ink-50)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-5 py-2 bg-[var(--color-brand)] text-white text-[13px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {pending ? "Sending..." : "Send Prompt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
