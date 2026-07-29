export const dynamic = "force-dynamic";

import { getWebhookSubscriptions } from "./actions";
import { WebhooksClient } from "./WebhooksClient";

export default async function WebhooksSettingsPage() {
  const subscriptions = await getWebhookSubscriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-ink-900)]">Webhooks & Workflow Automation</h1>
        <p className="text-sm text-[var(--color-ink-500)] mt-1">
          Broadcast live Zeno ERP events to external tools like <strong>n8n</strong>, <strong>Zapier</strong>, <strong>Slack</strong>, or custom web servers.
        </p>
      </div>

      <WebhooksClient initialSubscriptions={subscriptions} />
    </div>
  );
}
