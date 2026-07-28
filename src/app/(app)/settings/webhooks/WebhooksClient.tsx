"use client";

import { useState } from "react";
import {
  addWebhookSubscriptionAction,
  toggleWebhookSubscriptionAction,
  deleteWebhookSubscriptionAction,
  testWebhookSubscriptionAction,
} from "./actions";

interface WebhookSub {
  id: number;
  url: string;
  secret: string;
  events: string;
  active: boolean;
  createdAt: string;
}

const AVAILABLE_EVENTS = [
  { key: "invoice.created", label: "Invoice Created", desc: "Fired when a new tax invoice is issued" },
  { key: "invoice.paid", label: "Invoice Fully Paid", desc: "Fired when an invoice balance reaches zero" },
  { key: "quote.created", label: "Quote Created", desc: "Fired when a new quotation/estimate is created" },
  { key: "quote.accepted", label: "Quote Accepted", desc: "Fired when a customer accepts a quotation" },
  { key: "payment.received", label: "Payment Received", desc: "Fired when any customer payment is logged" },
  { key: "bill.created", label: "Vendor Bill Created", desc: "Fired when a supplier bill is entered" },
  { key: "stock.low", label: "Stock Level Low", desc: "Fired when inventory quantity drops below reorder point" },
];

export function WebhooksClient({ initialSubscriptions }: { initialSubscriptions: WebhookSub[] }) {
  const [subs, setSubs] = useState<WebhookSub[]>(initialSubscriptions);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<number, string>>({});
  const [errorMsg, setErrorMsg] = useState("");

  const handleToggle = async (id: number, currentActive: boolean) => {
    const next = !currentActive;
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, active: next } : s)));
    await toggleWebhookSubscriptionAction(id, next);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this webhook endpoint?")) return;
    setSubs((prev) => prev.filter((s) => s.id !== id));
    await deleteWebhookSubscriptionAction(id);
  };

  const handleTest = async (id: number) => {
    setTestStatus((prev) => ({ ...prev, [id]: "Testing..." }));
    const res = await testWebhookSubscriptionAction(id);
    if ("success" in res && res.success) {
      setTestStatus((prev) => ({ ...prev, [id]: "✅ Test Event Delivered (HTTP 200)" }));
    } else {
      setTestStatus((prev) => ({ ...prev, [id]: `❌ Delivery Failed: ${res.error || "Unknown Error"}` }));
    }
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const res = await addWebhookSubscriptionAction(formData);

    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setShowAddModal(false);
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[var(--color-ink-200)] shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">Active Webhook Subscriptions</h2>
          <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
            Zeno signs all webhook payloads with an <code>X-Zeno-Signature</code> HMAC header.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
        >
          <span>+ Add Webhook Endpoint</span>
        </button>
      </div>

      {/* Subscriptions List */}
      {subs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-[var(--color-ink-200)]">
          <div className="w-12 h-12 bg-[var(--color-accent-50)] text-[var(--color-accent-600)] rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
            ⚡
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-ink-800)]">No Webhook Endpoints Configured</h3>
          <p className="text-xs text-[var(--color-ink-500)] max-w-sm mx-auto mt-1 mb-4">
            Connect Zeno ERP to <strong>n8n</strong>, <strong>Make</strong>, <strong>Zapier</strong>, or <strong>Webhook.site</strong> to automate workflows.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-[var(--color-accent-600)] bg-[var(--color-accent-50)] hover:bg-[var(--color-accent-100)] rounded-lg transition-colors"
          >
            Add Your First Endpoint
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            let eventsList: string[] = [];
            try {
              eventsList = JSON.parse(sub.events);
            } catch {
              eventsList = [sub.events];
            }

            return (
              <div key={sub.id} className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${sub.active ? "bg-emerald-500" : "bg-gray-300"}`} />
                      <span className="font-mono text-sm font-semibold text-[var(--color-ink-900)] truncate">{sub.url}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-ink-500)]">
                      <span>Secret:</span>
                      <code className="bg-[var(--color-ink-50)] px-2 py-0.5 rounded text-[11px] font-mono text-[var(--color-ink-700)]">
                        {sub.secret.slice(0, 8)}••••••••••••••••
                      </code>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTest(sub.id)}
                      className="px-2.5 py-1 text-xs font-medium text-[var(--color-ink-700)] bg-[var(--color-ink-50)] hover:bg-[var(--color-ink-100)] border border-[var(--color-ink-200)] rounded-md transition-colors"
                    >
                      Send Test Event
                    </button>

                    <button
                      onClick={() => handleToggle(sub.id, sub.active)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        sub.active
                          ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      {sub.active ? "Pause" : "Enable"}
                    </button>

                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Subscribed Events Tags */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--color-ink-100)]">
                  <span className="text-xs font-medium text-[var(--color-ink-500)] mr-1">Subscribed Events:</span>
                  {eventsList.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-accent-50)] text-[var(--color-accent-700)]"
                    >
                      {e}
                    </span>
                  ))}
                </div>

                {/* Test Delivery Feedback */}
                {testStatus[sub.id] && (
                  <div className="text-xs font-medium text-[var(--color-ink-700)] bg-slate-50 p-2 rounded border border-slate-200">
                    {testStatus[sub.id]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-[var(--color-ink-100)]">
            <div className="flex items-center justify-between border-b border-[var(--color-ink-100)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-ink-900)]">Add Outbound Webhook Endpoint</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Webhook URL (HTTP / HTTPS)
                </label>
                <input
                  type="url"
                  name="url"
                  required
                  placeholder="https://webhook.site/your-unique-id or https://n8n.yourcompany.com/webhook/..."
                  className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-2">
                  Select Event Triggers
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {AVAILABLE_EVENTS.map((ev) => (
                    <label
                      key={ev.key}
                      className="flex items-start gap-2.5 p-2 rounded-lg border border-[var(--color-ink-100)] hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        name="events"
                        value={ev.key}
                        defaultChecked
                        className="mt-0.5 accent-[var(--color-accent-600)]"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-ink-900)]">{ev.label}</div>
                        <div className="text-[11px] text-[var(--color-ink-500)]">{ev.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-ink-100)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--color-ink-600)] bg-[var(--color-ink-100)] hover:bg-[var(--color-ink-200)] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating Endpoint..." : "Save Webhook Endpoint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
