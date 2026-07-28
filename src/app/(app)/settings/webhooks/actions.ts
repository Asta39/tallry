"use server";

import { db, webhookSubscriptions } from "@/db";
import { eq, and } from "drizzle-orm";
import { currentOrgId, withOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { sendTestWebhook } from "@/lib/events/bus";

export async function getWebhookSubscriptions() {
  return withOrg(async () => {
    return db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.orgId, currentOrgId()));
  });
}

export async function addWebhookSubscriptionAction(formData: FormData) {
  return withOrg(async () => {
    const url = String(formData.get("url") || "").trim();
    const eventsSelected = formData.getAll("events").map(String);

    if (!url || !url.startsWith("http")) {
      return { error: "Please enter a valid HTTP or HTTPS webhook URL" };
    }

    if (!eventsSelected.length) {
      return { error: "Please select at least one event type to subscribe to" };
    }

    const secret = randomBytes(24).toString("hex");

    await db.insert(webhookSubscriptions).values({
      orgId: currentOrgId(),
      url,
      secret,
      events: JSON.stringify(eventsSelected),
      active: true,
      createdAt: new Date().toISOString(),
    });

    revalidatePath("/settings/webhooks");
    return { success: true };
  });
}

export async function toggleWebhookSubscriptionAction(id: number, active: boolean) {
  return withOrg(async () => {
    await db
      .update(webhookSubscriptions)
      .set({ active })
      .where(and(eq(webhookSubscriptions.orgId, currentOrgId()), eq(webhookSubscriptions.id, id)));

    revalidatePath("/settings/webhooks");
    return { success: true };
  });
}

export async function deleteWebhookSubscriptionAction(id: number) {
  return withOrg(async () => {
    await db
      .delete(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.orgId, currentOrgId()), eq(webhookSubscriptions.id, id)));

    revalidatePath("/settings/webhooks");
    return { success: true };
  });
}

export async function testWebhookSubscriptionAction(id: number) {
  return withOrg(async () => {
    const [sub] = await db
      .select()
      .from(webhookSubscriptions)
      .where(and(eq(webhookSubscriptions.orgId, currentOrgId()), eq(webhookSubscriptions.id, id)))
      .limit(1);

    if (!sub) return { error: "Webhook subscription not found" };

    const res = await sendTestWebhook(sub.url, sub.secret);
    return res;
  });
}
