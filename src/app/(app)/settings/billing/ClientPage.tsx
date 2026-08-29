"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Entitlements } from "@/lib/billing";
import { fmtKES } from "@/lib/money";
import { initiateMaintenancePaymentAction, initiateMaintenanceCardPaymentAction, checkMaintenancePaymentAction } from "./actions";

interface PaymentRow {
  id: number;
  kind: string;
  amountCents: number;
  method: string;
  state: string;
  createdAt: string;
}

const INCLUDED_FEATURES = [
  { icon: "🧾", label: "Invoices, quotes, credit notes", desc: "KRA-compliant VAT on every line, eTIMS-ready" },
  { icon: "📦", label: "Bills, purchase orders & inventory", desc: "FIFO costing, warehouses, stock transfers" },
  { icon: "🏦", label: "Bank & M-Pesa reconciliation", desc: "Match statements, categorize, mirror the real books" },
  { icon: "💳", label: "Payment gateways & customer portal", desc: "M-Pesa/Daraja, Kopo Kopo, card checkout, self-service portal" },
  { icon: "🧑‍💼", label: "Payroll, loans & salary advances", desc: "PAYE, NSSF, SHIF, AHL — statutory-compliant" },
  { icon: "🏢", label: "Multi-location reporting", desc: "P&L and cost centers broken down by branch" },
  { icon: "🖥️", label: "Fixed assets & depreciation", desc: "Full asset register, straight-line depreciation" },
  { icon: "🔁", label: "Recurring invoices & bills", desc: "Automate billing on a schedule you set" },
  { icon: "👥", label: "Unlimited staff & role permissions", desc: "Fine-grained access per team member" },
  { icon: "✨", label: "AI Assistant", desc: "Ask about your numbers, draft documents, get a daily brief" },
];

const MAINTENANCE_COVERS = [
  { icon: "☁️", label: "Hosting & uptime", desc: "Your books stay online and backed up, always" },
  { icon: "🛡️", label: "Security & data backups", desc: "Encrypted, regularly backed up, never lost" },
  { icon: "🇰🇪", label: "KRA/tax compliance updates", desc: "VAT, eTIMS, PAYE rules kept current automatically" },
  { icon: "🛠️", label: "New features, at no extra cost", desc: "Every update ships to you the moment it's ready" },
  { icon: "📞", label: "Direct support", desc: "Call or WhatsApp us when something's not clear" },
];

const WHY_US = [
  { label: "Built for Kenya, not adapted to it", desc: "VAT, eTIMS, M-Pesa, PAYE/NSSF/SHIF/AHL — native, not bolted on." },
  { label: "One person can run it", desc: "Calm, simple screens — no accounting degree or IT department required." },
  { label: "A real person answers", desc: "Onboarding and support from someone who knows your business, not a ticket queue." },
  { label: "Fair, predictable pricing", desc: "One setup fee, then a simple monthly fee per staff member — no feature paywalls." },
];

export function BillingClient({
  entitlements,
  orgPhone,
  orgEmail,
  history,
}: {
  entitlements: Entitlements;
  orgPhone: string;
  orgEmail: string;
  history: PaymentRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDue = !entitlements.nextMaintenanceDueAt || new Date().toISOString().slice(0, 10) >= entitlements.nextMaintenanceDueAt;

  const [modal, setModal] = useState<{
    isOpen: boolean;
    method: "mpesa" | "card";
    phone: string;
    email: string;
    status: "idle" | "processing" | "redirecting" | "success" | "error";
    error?: string;
  }>({
    isOpen: false,
    method: "mpesa",
    phone: orgPhone,
    email: orgEmail,
    status: "idle",
  });

  const pollPayment = async (paymentId: number) => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const check = await checkMaintenancePaymentAction(paymentId);
      if ("error" in check && check.error) {
        setModal((prev) => ({ ...prev, isOpen: true, status: "error", error: check.error }));
        return;
      }
      if ("status" in check) {
        if (check.status === "complete") {
          setModal((prev) => ({ ...prev, isOpen: true, status: "success" }));
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
        if (check.status === "failed") {
          setModal((prev) => ({ ...prev, isOpen: true, status: "error", error: check.reason || "Payment failed — no money was taken." }));
          return;
        }
      }
    }
    setModal((prev) => ({
      ...prev,
      isOpen: true,
      status: "error",
      error: "We didn't get a confirmation in time. If you completed the payment, it will apply automatically within a few minutes.",
    }));
  };

  useEffect(() => {
    const paymentId = searchParams.get("payment");
    if (!paymentId) return;
    setModal((prev) => ({ ...prev, isOpen: true, status: "processing" }));
    router.replace("/settings/billing");
    pollPayment(Number(paymentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMpesaPayment = async () => {
    if (!modal.phone) return;
    setModal((prev) => ({ ...prev, status: "processing", error: undefined }));
    try {
      const res = await initiateMaintenancePaymentAction(modal.phone);
      if ("error" in res && res.error) {
        setModal((prev) => ({ ...prev, status: "error", error: res.error }));
        return;
      }
      await pollPayment((res as { paymentId: number }).paymentId);
    } catch (e: any) {
      setModal((prev) => ({ ...prev, status: "error", error: e.message || "An error occurred." }));
    }
  };

  const handleCardPayment = async () => {
    if (!modal.email) return;
    setModal((prev) => ({ ...prev, status: "redirecting", error: undefined }));
    try {
      const res = await initiateMaintenanceCardPaymentAction(modal.email);
      if ("error" in res && res.error) {
        setModal((prev) => ({ ...prev, status: "error", error: res.error }));
        return;
      }
      window.location.href = (res as { checkoutUrl: string }).checkoutUrl;
    } catch (e: any) {
      setModal((prev) => ({ ...prev, status: "error", error: e.message || "An error occurred." }));
    }
  };

  const closeModal = () => setModal((prev) => ({ ...prev, isOpen: false, status: "idle", error: undefined }));

  return (
    <div className="space-y-16 pb-12 relative">
      {/* Hero */}
      <div className="relative pt-12 pb-8 text-center rounded-3xl overflow-hidden bg-gradient-to-b from-[var(--color-brand)]/10 to-transparent">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-2xl bg-[var(--color-brand)]/5 blur-3xl rounded-full" />
        <div className="relative z-10 px-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full mb-4 ${
              entitlements.status === "trial" ? "bg-amber-100 text-amber-800" : "bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {entitlements.status === "trial" ? `Trial · ${entitlements.trialDaysLeft} day${entitlements.trialDaysLeft === 1 ? "" : "s"} left` : "Active account"}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[var(--color-ink-900)] tracking-tight">
            Everything your business <br className="md:hidden" /> needs, all included
          </h1>
          <p className="mt-4 text-base text-[var(--color-ink-600)] max-w-2xl mx-auto">
            One setup fee, then a monthly fee per staff member — no tiers, no locked features.
          </p>
        </div>
      </div>

      {/* Status / fee card */}
      <div className="max-w-2xl mx-auto px-4">
        {entitlements.status === "trial" && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900">
            <div className="text-[13.5px] font-semibold">
              Trial — {entitlements.trialDaysLeft} day{entitlements.trialDaysLeft === 1 ? "" : "s"} left
            </div>
            <div className="mt-1 text-[13px] text-amber-800">
              Full access until {entitlements.trialEndsAt}. Contact us to continue after the trial ends.
            </div>
          </div>
        )}

        <div className="card p-6">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--color-ink-400)]">Monthly maintenance fee</div>
          <div className="mt-1 text-[28px] font-bold tnum">
            {entitlements.monthlyFeeCents > 0 ? fmtKES(entitlements.monthlyFeeCents) : "Not set yet"}
          </div>
          {entitlements.nextMaintenanceDueAt && (
            <div className="mt-1 text-[12.5px] text-[var(--color-ink-500)]">Next due {entitlements.nextMaintenanceDueAt}</div>
          )}
          {entitlements.monthlyFeeCents > 0 && (
            isDue ? (
              <button
                onClick={() => setModal((prev) => ({ ...prev, isOpen: true, status: "idle", error: undefined }))}
                className="mt-4 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2"
              >
                Pay now
              </button>
            ) : (
              <button
                disabled
                title={`Not due until ${entitlements.nextMaintenanceDueAt}`}
                className="mt-4 rounded-lg bg-[var(--color-ink-100)] text-[var(--color-ink-400)] text-[13px] font-medium px-4 py-2 cursor-not-allowed"
              >
                Not due yet
              </button>
            )
          )}
        </div>
      </div>

      {/* What's included */}
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">What's included</h2>
        <p className="text-center text-[13.5px] text-[var(--color-ink-500)] mt-2 max-w-lg mx-auto">
          Every module below is part of your account from day one — nothing here is a paid add-on.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {INCLUDED_FEATURES.map((f) => (
            <div key={f.label} className="card p-4 flex items-start gap-3">
              <span className="text-[20px] shrink-0">{f.icon}</span>
              <div>
                <div className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">{f.label}</div>
                <div className="text-[12px] text-[var(--color-ink-500)] mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What maintenance covers */}
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">What your maintenance fee covers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          {MAINTENANCE_COVERS.map((f) => (
            <div key={f.label} className="flex items-start gap-3">
              <span className="text-[18px] shrink-0">{f.icon}</span>
              <div>
                <div className="text-[13.5px] font-semibold text-[var(--color-ink-900)]">{f.label}</div>
                <div className="text-[12px] text-[var(--color-ink-500)] mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Why us */}
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center text-[var(--color-ink-900)] tracking-tight">Why businesses choose us</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
          {WHY_US.map((w) => (
            <div key={w.label} className="rounded-2xl border border-[var(--color-ink-200)] bg-white p-5">
              <div className="text-[14px] font-semibold text-[var(--color-ink-900)]">{w.label}</div>
              <div className="text-[12.5px] text-[var(--color-ink-500)] mt-1.5">{w.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment history */}
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">Payment history</h2>
        {history.length === 0 ? (
          <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No payments recorded yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead className="hairline-b">
                <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left px-4 py-2.5 font-semibold">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Method</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="hairline-t">
                    <td className="px-4 py-3 text-[13px]">{p.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {p.kind === "setup_fee" ? "One-time setup" : p.kind === "module_fee" ? "Module unlock" : "Maintenance"}
                    </td>
                    <td className="px-4 py-3 text-[13px] capitalize">{p.method}</td>
                    <td className="px-4 py-3 text-[13px] text-right tnum">{fmtKES(p.amountCents)}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          p.state === "applied" || p.state === "COMPLETE"
                            ? "bg-emerald-50 text-emerald-700"
                            : p.state === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : "bg-[var(--color-ink-100)] text-[var(--color-ink-500)]"
                        }`}
                      >
                        {p.state === "applied" ? "Paid" : p.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.isOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            {modal.status === "success" ? (
              <div className="text-center py-4">
                <div className="text-[15px] font-semibold text-[var(--color-good)]">Payment received</div>
                <p className="mt-2 text-[13px] text-[var(--color-ink-500)]">Reloading…</p>
              </div>
            ) : modal.status === "error" ? (
              <div>
                <div className="text-[15px] font-semibold text-[var(--color-bad)] mb-2">Payment issue</div>
                <p className="text-[13px] text-[var(--color-ink-500)] mb-4">{modal.error}</p>
                <button onClick={closeModal} className="rounded-lg border border-[var(--color-ink-200)] px-4 py-2 text-[13px] font-medium">Close</button>
              </div>
            ) : modal.status === "processing" || modal.status === "redirecting" ? (
              <div className="text-center py-4">
                <div className="text-[15px] font-semibold">{modal.status === "redirecting" ? "Redirecting to checkout…" : "Waiting for confirmation…"}</div>
                <p className="mt-2 text-[13px] text-[var(--color-ink-500)]">
                  {modal.method === "mpesa" ? "Check your phone and enter your M-Pesa PIN." : "Complete the payment in the new tab."}
                </p>
              </div>
            ) : (
              <div>
                <div className="text-[15px] font-semibold mb-1">Pay {fmtKES(entitlements.monthlyFeeCents)}</div>
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setModal((prev) => ({ ...prev, method: "mpesa" }))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${modal.method === "mpesa" ? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)]" : "border-[var(--color-ink-200)]"}`}
                  >
                    M-Pesa
                  </button>
                  <button
                    onClick={() => setModal((prev) => ({ ...prev, method: "card" }))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium ${modal.method === "card" ? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)]" : "border-[var(--color-ink-200)]"}`}
                  >
                    Card
                  </button>
                </div>
                {modal.method === "mpesa" ? (
                  <input
                    type="tel"
                    value={modal.phone}
                    onChange={(e) => setModal((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="07xx xxx xxx"
                    className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] mb-4"
                  />
                ) : (
                  <input
                    type="email"
                    value={modal.email}
                    onChange={(e) => setModal((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@yourco.co.ke"
                    className="w-full rounded-lg border border-[var(--color-ink-200)] px-3 py-2 text-[13px] mb-4"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={modal.method === "mpesa" ? handleMpesaPayment : handleCardPayment}
                    className="flex-1 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2"
                  >
                    Pay now
                  </button>
                  <button onClick={closeModal} className="rounded-lg border border-[var(--color-ink-200)] px-4 py-2 text-[13px] font-medium">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
