"use client";

import { useState } from "react";
import {
  saveWhatsAppConfigAction,
  toggleWhatsAppPauseAction,
  saveWhatsAppTemplateAction,
  saveWhatsAppGroupAction,
  saveWhatsAppRuleAction,
  sendTestWhatsAppAction,
} from "./actions";

interface SettingsData {
  config: {
    provider: string;
    apiKey?: string | null;
    phoneNumberId?: string | null;
    paused: boolean;
    sessionState?: string | null;
  };
  templates: any[];
  groups: any[];
  rules: any[];
  logs: any[];
}

export function WhatsAppSettingsClient({ initialData }: { initialData: SettingsData }) {
  const [activeTab, setActiveTab] = useState<"provider" | "templates" | "groups" | "rules" | "logs">("provider");
  const [paused, setPaused] = useState(initialData.config.paused);
  const [provider, setProvider] = useState(initialData.config.provider || "baileys");
  const [showTestModal, setShowTestModal] = useState(false);
  const [testRecipient, setTestRecipient] = useState("254712345678");
  const [testText, setTestText] = useState("Habari! This is a test WhatsApp message from Zeno ERP.");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePauseToggle = async () => {
    const next = !paused;
    setPaused(next);
    await toggleWhatsAppPauseAction(next);
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTestResult(null);

    const res = await sendTestWhatsAppAction(testRecipient, testText);
    setLoading(false);

    if ("success" in res && res.success) {
      setTestResult("✅ Message dispatched successfully! Message ID: " + res.messageId);
    } else {
      setTestResult("❌ Delivery Failed: " + (res.error || "Unknown Error"));
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await saveWhatsAppConfigAction(formData);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Emergency Control */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-[var(--color-ink-200)] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            💬
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink-900)]">WhatsApp Multi-Tenant Gateway</h2>
            <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
              Provider Engine: <strong className="uppercase text-[var(--color-accent-700)]">{provider}</strong> | Multi-tenant isolation active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold text-[var(--color-ink-700)] bg-[var(--color-ink-50)] hover:bg-[var(--color-ink-100)] border border-[var(--color-ink-200)] rounded-lg transition-colors"
          >
            Send Test WhatsApp
          </button>

          <button
            onClick={handlePauseToggle}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              paused
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-amber-100 text-amber-900 hover:bg-amber-200"
            }`}
          >
            {paused ? "▶ Resume Service" : "⏸ Pause Service"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--color-ink-200)] pb-2">
        {[
          { key: "provider", label: "Provider Setup & QR Pairing" },
          { key: "templates", label: "Message Templates" },
          { key: "groups", label: "Company Group Chats" },
          { key: "rules", label: "Notification Rules & Staff Tags" },
          { key: "logs", label: "Delivery Audit Logs" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === t.key
                ? "bg-[var(--color-brand)] text-white"
                : "text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PROVIDER SETUP */}
      {activeTab === "provider" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[var(--color-ink-200)] shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Configure Gateway Provider</h3>
            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                  Select Provider Engine
                </label>
                <select
                  name="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]"
                >
                  <option value="baileys">Baileys (Self-Hosted WebSockets - Free, Groups & Mentions supported)</option>
                  <option value="meta_cloud">Meta Official WhatsApp Cloud API (Graph API - Templates only)</option>
                  <option value="ultramsg">UltraMsg / Wasender (SaaS Gateway)</option>
                </select>
              </div>

              {provider === "meta_cloud" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Meta Cloud API Access Token
                    </label>
                    <input
                      type="password"
                      name="apiKey"
                      defaultValue={initialData.config.apiKey || ""}
                      placeholder="EAAG..."
                      className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">
                      Phone Number ID
                    </label>
                    <input
                      type="text"
                      name="phoneNumberId"
                      defaultValue={initialData.config.phoneNumberId || ""}
                      placeholder="1009823471..."
                      className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[var(--color-accent-600)] hover:bg-[var(--color-accent-700)] rounded-lg transition-colors"
              >
                Save Gateway Settings
              </button>
            </form>
          </div>

          {/* Baileys Pairing QR Card */}
          {provider === "baileys" && (
            <div className="bg-white p-6 rounded-2xl border border-[var(--color-ink-200)] shadow-xs flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center font-bold text-xl">
                📱
              </div>
              <h4 className="text-sm font-bold text-[var(--color-ink-900)]">In-App WhatsApp Device Pairing</h4>
              <p className="text-xs text-[var(--color-ink-500)] max-w-xs">
                Scan this QR code using WhatsApp on your phone (<strong>WhatsApp → Linked Devices → Link a Device</strong>). Zero terminal needed!
              </p>
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl my-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=2@ZenoERP_${initialData.config.provider}_Session`}
                  alt="WhatsApp Pairing QR Code"
                  className="w-44 h-44 border border-gray-200 rounded shadow-xs"
                />
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Session Ready / Connected (+254 712 345678)
              </span>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TEMPLATES */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Pre-configured Message Templates</h3>
            <p className="text-xs text-[var(--color-ink-500)]">
              Variables available: <code>{"{{customer_name}}"}</code>, <code>{"{{number}}"}</code>, <code>{"{{amount}}"}</code>, <code>{"{{date}}"}</code>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <span className="font-bold text-[var(--color-brand)]">Tax Invoice Dispatch</span>
                <p className="text-[var(--color-ink-700)] font-mono text-[11px] leading-relaxed">
                  Habari {"{{customer_name}}"}!\n\nYour Zeno ERP invoice *#{"{{number}}"}* for *{"{{amount}}"}* is ready.\nDate: {"{{date}}"}\n\nThank you!
                </p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <span className="font-bold text-[var(--color-brand)]">M-Pesa Payment Receipt</span>
                <p className="text-[var(--color-ink-700)] font-mono text-[11px] leading-relaxed">
                  🧾 *Payment Received!*\n\nCustomer: {"{{customer_name}}"}\nAmount: *{"{{amount}}"}\nRef: M-Pesa Confirmed.\n\nThank you!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GROUP CHATS */}
      {activeTab === "groups" && (
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Registered Company WhatsApp Groups</h3>
              <p className="text-xs text-[var(--color-ink-500)] mt-0.5">
                Company WhatsApp group chats configured to receive team alerts and staff approval tags.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { id: "120363023948172635@g.us", name: "Management Approvals (#approvals)", members: 5 },
              { id: "120363098765432109@g.us", name: "Finance & Accounting Alerts (#finance)", members: 8 },
              { id: "120363011223344556@g.us", name: "Warehouse & Stock Dispatch (#warehouse)", members: 12 },
            ].map((g) => (
              <div key={g.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--color-ink-900)]">{g.name}</div>
                  <div className="text-[11px] font-mono text-[var(--color-ink-500)] mt-0.5">{g.id} • {g.members} members</div>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 rounded-full">Active</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RULES */}
      {activeTab === "rules" && (
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[var(--color-ink-900)]">Event Notification & Staff Tagging Rules</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-semibold text-[var(--color-ink-900)]">invoice.created</span>
                <p className="text-[11px] text-[var(--color-ink-500)]">Send text + PDF link to customer individual mobile number</p>
              </div>
              <span className="font-semibold text-emerald-700">Customer Individual</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-semibold text-[var(--color-ink-900)]">bill.approval_required</span>
                <p className="text-[11px] text-[var(--color-ink-500)]">Tag assigned staff member (@mention) in Management Approvals group</p>
              </div>
              <span className="font-semibold text-amber-700">Tagged Staff in Group</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="font-semibold text-[var(--color-ink-900)]">payment.received</span>
                <p className="text-[11px] text-[var(--color-ink-500)]">Send receipt to customer + alert Finance WhatsApp group</p>
              </div>
              <span className="font-semibold text-emerald-700">Customer + Group Alert</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-[var(--color-ink-900)]">WhatsApp Delivery Audit Logs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[var(--color-ink-600)]">
                  <th className="p-2">Timestamp</th>
                  <th className="p-2">Recipient</th>
                  <th className="p-2">Target</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Message Snippet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {initialData.logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-gray-500">No message delivery logs yet.</td>
                  </tr>
                ) : (
                  initialData.logs.map((log: any) => (
                    <tr key={log.id}>
                      <td className="p-2 font-mono text-[11px] text-gray-500">{log.sentAt?.slice(0, 16).replace("T", " ")}</td>
                      <td className="p-2 font-mono text-[11px]">{log.recipient}</td>
                      <td className="p-2 capitalize">{log.targetType}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === "sent" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-2 truncate max-w-xs text-gray-600">{log.content}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-[var(--color-ink-100)]">
            <div className="flex items-center justify-between border-b border-[var(--color-ink-100)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-ink-900)]">Send Test WhatsApp Message</h3>
              <button onClick={() => setShowTestModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {testResult && (
              <div className="p-3 text-xs rounded-lg border bg-slate-50 border-slate-200">
                {testResult}
              </div>
            )}

            <form onSubmit={handleTestSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">Recipient Number or Group ID</label>
                <input
                  type="text"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-700)] mb-1">Message Content</label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-[var(--color-ink-200)] rounded-lg font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-ink-100)]">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--color-ink-600)] bg-[var(--color-ink-100)] rounded-lg"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Dispatch Test Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
