"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { saveSmsSettingsAction, sendTestSmsAction } from "./actions";

const inputCls = "w-full h-10 px-3 rounded-lg border border-[var(--color-ink-200)] focus:border-[var(--color-brand-500)] outline-none text-sm";

export function SmsSettingsForm({ settings }: { settings: { enabled: boolean; hasSecrets: boolean; senderId: string } }) {
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await saveSmsSettingsAction(new FormData(e.currentTarget));
      if (res && "error" in res && res.error) { alert("Error: " + res.error); return; }
      alert("SMS settings saved");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!testPhone) { alert("Enter a phone number to send the test to"); return; }
    setTesting(true);
    try {
      const res = await sendTestSmsAction(testPhone);
      if (res && "error" in res && res.error) { alert("Error: " + res.error); return; }
      alert("Test SMS sent — check the phone");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[var(--color-ink-200)] p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-3">
          <input type="checkbox" name="enabled" id="sms_enabled" defaultChecked={settings.enabled} className="w-4 h-4" />
          <label htmlFor="sms_enabled" className="font-medium">Send SMS receipts via Advanta</label>
        </div>
        <p className="text-sm text-[var(--color-ink-500)]">
          When a gateway payment is applied, the payer gets an SMS with a secure link to their PDF receipt.
          {settings.hasSecrets && " Credentials are saved — leave fields blank to keep them."}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Sender ID *</label>
            <input name="senderId" defaultValue={settings.senderId} placeholder="e.g. ZENO" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Partner ID</label>
            <input name="partnerId" type="password" placeholder={settings.hasSecrets ? "Masked" : "From Advanta portal"} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input name="apiKey" type="password" placeholder={settings.hasSecrets ? "Masked" : "From Advanta portal"} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={loading}>{loading ? "Saving..." : "Save Settings"}</PrimaryButton>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-[var(--color-ink-200)]">
        <label className="block text-sm font-medium mb-1">Send test SMS</label>
        <div className="flex gap-3">
          <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="07XX XXX XXX" className={inputCls + " max-w-xs"} />
          <PrimaryButton type="button" onClick={handleTest} disabled={testing}>
            {testing ? "Sending..." : "Send Test"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
