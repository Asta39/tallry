import { createHmac, randomUUID } from "crypto";
import { db, webhookSubscriptions } from "@/db";
import { eq, and } from "drizzle-orm";
import { ZenoEventType, ZenoEventPayload } from "./types";
import { dispatchWhatsAppNotification } from "@/lib/whatsapp/dispatcher";

/**
 * Emit a business event to all registered outbound webhooks and WhatsApp automation.
 * Operates asynchronously in the background so it never blocks the primary request lifecycle.
 */
export function emitZenoEvent<T = Record<string, any>>(
  eventType: ZenoEventType,
  orgId: number,
  data: T
): void {
  // Execute async background dispatch
  dispatchAsync(eventType, orgId, data).catch((err) => {
    console.error(`[Zeno EventBus Error] Unhandled error dispatching '${eventType}' for org ${orgId}:`, err);
  });

  // Execute async WhatsApp notification dispatch
  dispatchWhatsAppNotification(eventType, orgId, data as any).catch((err) => {
    console.error(`[Zeno WhatsApp Dispatcher Error] Unhandled error for '${eventType}' org ${orgId}:`, err);
  });
}

async function dispatchAsync<T>(
  eventType: ZenoEventType,
  orgId: number,
  data: T
): Promise<void> {
  const subs = await db
    .select()
    .from(webhookSubscriptions)
    .where(and(eq(webhookSubscriptions.orgId, orgId), eq(webhookSubscriptions.active, true)));

  if (!subs.length) return;

  const payload: ZenoEventPayload<T> = {
    eventId: `evt_${randomUUID().replace(/-/g, "")}`,
    eventType,
    orgId,
    timestamp: new Date().toISOString(),
    data,
  };

  const payloadJson = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      // Check if sub is subscribed to this event or "*"
      let subscribedEvents: string[] = [];
      try {
        subscribedEvents = JSON.parse(sub.events);
      } catch {
        subscribedEvents = [sub.events];
      }

      if (!subscribedEvents.includes(eventType) && !subscribedEvents.includes("*")) {
        continue;
      }

      // Compute HMAC SHA256 Signature
      const signature = createHmac("sha256", sub.secret)
        .update(payloadJson)
        .digest("hex");

      // Dispatch async HTTP POST request
      fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Zeno-ERP-Webhook/1.0",
          "X-Zeno-Event": eventType,
          "X-Zeno-Signature": `sha256=${signature}`,
        },
        body: payloadJson,
        signal: AbortSignal.timeout(8000), // 8 second timeout
      }).catch((err) => {
        console.warn(`[Zeno Webhook Warning] Delivery to ${sub.url} failed:`, err.message || err);
      });
    } catch (err: any) {
      console.warn(`[Zeno Webhook Warning] Error preparing delivery for sub ${sub.id}:`, err.message || err);
    }
  }
}

/**
 * Utility to send a single test webhook event payload for UI verification.
 */
export async function sendTestWebhook(url: string, secret: string): Promise<{ success: boolean; status?: number; error?: string }> {
  const payload: ZenoEventPayload = {
    eventId: `evt_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    eventType: "invoice.created",
    orgId: 0,
    timestamp: new Date().toISOString(),
    data: {
      test: true,
      message: "Hello from Zeno ERP Webhook Engine!",
      invoiceNumber: "INV-TEST-001",
      customerName: "Test Customer Ltd",
      totalCents: 1500000,
      currency: "KES",
    },
  };

  const payloadJson = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(payloadJson).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Zeno-ERP-Webhook/1.0",
        "X-Zeno-Event": "invoice.created",
        "X-Zeno-Signature": `sha256=${signature}`,
      },
      body: payloadJson,
      signal: AbortSignal.timeout(10000),
    });

    return {
      success: res.ok,
      status: res.status,
      error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Network error / Connection refused",
    };
  }
}
