import { db, paymentEvents, org } from "@/db";
import { desc, eq } from "drizzle-orm";
import { fmtKES } from "@/lib/money";

export default async function AdminPaymentsPage() {
  const events = await db
    .select({
      id: paymentEvents.id,
      orgName: org.name,
      gatewayId: paymentEvents.gatewayId,
      providerRef: paymentEvents.providerRef,
      amountCents: paymentEvents.amountCents,
      payerPhone: paymentEvents.payerPhone,
      payerName: paymentEvents.payerName,
      status: paymentEvents.status,
      createdAt: paymentEvents.createdAt,
    })
    .from(paymentEvents)
    .leftJoin(org, eq(paymentEvents.orgId, org.id))
    .orderBy(desc(paymentEvents.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payment Events (Logs)</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">Raw payment webhooks across all tenants (last 100).</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--color-ink-50)] border-b border-[var(--color-ink-200)] text-[13px] text-[var(--color-ink-600)] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Org</th>
                <th className="px-4 py-3 font-medium">Provider Ref</th>
                <th className="px-4 py-3 font-medium">Payer</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
                  <td className="px-4 py-3 text-[var(--color-ink-500)]">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{e.orgName || "Unknown"}</td>
                  <td className="px-4 py-3 font-medium">{e.providerRef}</td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--color-ink-900)]">{e.payerName || "-"}</div>
                    <div className="text-xs text-[var(--color-ink-500)]">{e.payerPhone || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {fmtKES(e.amountCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      e.status === "failed" || e.status === "unmatched" 
                        ? "bg-red-100 text-red-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-ink-500)]">
                    No payment events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
