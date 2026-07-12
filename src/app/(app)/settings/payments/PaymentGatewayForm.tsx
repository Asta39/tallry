"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { savePaymentGatewayAction } from "./actions";

export function PaymentGatewayForm({ gateways }: { gateways: any[] }) {
  const [activeTab, setActiveTab] = useState<"mpesa_daraja" | "kopokopo">("mpesa_daraja");
  const [loading, setLoading] = useState(false);

  const mpesa = gateways.find(g => g.gatewayId === "mpesa_daraja") || { enabled: false, environment: "sandbox" };
  const kopokopo = gateways.find(g => g.gatewayId === "kopokopo") || { enabled: false, environment: "sandbox" };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("gatewayId", activeTab);
    
    try {
      const res = await savePaymentGatewayAction(formData);
      if (res && res.error) {
        alert("Error: " + res.error);
        return;
      }
      alert("Settings saved successfully");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--color-ink-200)]">
      <div className="flex border-b border-[var(--color-ink-200)]">
        <button
          type="button"
          onClick={() => setActiveTab("mpesa_daraja")}
          className={`px-6 py-4 font-medium text-sm ${activeTab === "mpesa_daraja" ? "border-b-2 border-[var(--color-brand-600)] text-[var(--color-brand-700)]" : "text-[var(--color-ink-500)]"}`}
        >
          M-Pesa Daraja
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("kopokopo")}
          className={`px-6 py-4 font-medium text-sm ${activeTab === "kopokopo" ? "border-b-2 border-[var(--color-brand-600)] text-[var(--color-brand-700)]" : "text-[var(--color-ink-500)]"}`}
        >
          Kopo Kopo
        </button>
      </div>

      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === "mpesa_daraja" && (
            <>
              <div className="flex items-center gap-3">
                <input type="checkbox" name="enabled" id="mpesa_enabled" defaultChecked={mpesa.enabled} className="w-4 h-4" />
                <label htmlFor="mpesa_enabled" className="font-medium">Enable M-Pesa Daraja</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Environment</label>
                  <select name="environment" defaultValue={mpesa.environment} className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm">
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Shortcode (Paybill/Till) *</label>
                  <input name="shortcode" defaultValue={mpesa.config?.shortcode} placeholder="e.g. 174379" required className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Consumer Key</label>
                  <input name="consumerKey" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Consumer Secret</label>
                  <input name="consumerSecret" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Passkey</label>
                  <input name="passkey" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Initiator Name (for payouts)</label>
                  <input name="initiatorName" defaultValue={mpesa.config?.initiatorName} placeholder="B2C API operator username" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Security Credential (for payouts)</label>
                  <input name="securityCredential" type="password" placeholder="Masked — encrypted initiator password" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
              </div>
            </>
          )}

          {activeTab === "kopokopo" && (
            <>
              <div className="flex items-center gap-3">
                <input type="checkbox" name="enabled" id="kopo_enabled" defaultChecked={kopokopo.enabled} className="w-4 h-4" />
                <label htmlFor="kopo_enabled" className="font-medium">Enable Kopo Kopo</label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Environment</label>
                  <select name="environment" defaultValue={kopokopo.environment} className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm">
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Till Number *</label>
                  <input name="tillNumber" defaultValue={kopokopo.config?.tillNumber} placeholder="e.g. 54321" required className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client ID</label>
                  <input name="clientId" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Secret</label>
                  <input name="clientSecret" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">API Key (Webhook HMAC)</label>
                  <input name="apiKey" type="password" placeholder="Masked" className="w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm" />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Settings"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
