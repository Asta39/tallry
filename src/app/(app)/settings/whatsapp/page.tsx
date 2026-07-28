import { getWhatsAppSettingsData } from "./actions";
import { WhatsAppSettingsClient } from "./WhatsAppSettingsClient";

export default async function WhatsAppSettingsPage() {
  const data = await getWhatsAppSettingsData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)]">WhatsApp Automation & Staff Alerts</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">
          Multi-tenant WhatsApp engine: send customer invoices, M-Pesa receipts, overdue debt collection, company group chat alerts, and staff <code>@mentions</code>.
        </p>
      </div>

      <WhatsAppSettingsClient initialData={data} />
    </div>
  );
}
