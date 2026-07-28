import { db, whatsappRules, whatsappTemplates, whatsappLogs, contacts, documents, org } from "@/db";
import { eq, and } from "drizzle-orm";
import { getWhatsAppProvider } from "./factory";
import { ZenoEventType } from "../events/types";
import { fmtKES } from "../money";

/**
 * Main WhatsApp Event Dispatcher.
 * Handles template rendering, opt-in consent checks, group chats, staff tagging, and audit logging.
 */
export async function dispatchWhatsAppNotification(
  eventType: ZenoEventType,
  orgId: number,
  data: Record<string, any>
): Promise<void> {
  try {
    const { provider, paused } = await getWhatsAppProvider(orgId);
    if (paused) {
      console.log(`[WhatsApp Dispatcher] Org ${orgId} WhatsApp service is paused. Skipping.`);
      return;
    }

    // Map Zeno EventType to rule event key
    const ruleKey = eventType.replace(".", "_");

    // Fetch active rules for this event type
    const rules = await db
      .select()
      .from(whatsappRules)
      .where(and(eq(whatsappRules.orgId, orgId), eq(whatsappRules.eventType, eventType), eq(whatsappRules.active, true)));

    if (!rules.length) {
      // Default rule behavior if no custom rules configured
      await handleDefaultDispatch(provider, eventType, orgId, data);
      return;
    }

    for (const rule of rules) {
      await processRule(provider, rule, orgId, data);
    }
  } catch (err: any) {
    console.error(`[WhatsApp Dispatcher Error] Failed for org ${orgId} event ${eventType}:`, err.message || err);
  }
}

async function handleDefaultDispatch(
  provider: any,
  eventType: ZenoEventType,
  orgId: number,
  data: Record<string, any>
): Promise<void> {
  const now = new Date().toISOString();

  if (eventType === "invoice.created" && data.invoiceId) {
    const [inv] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, data.invoiceId))).limit(1);
    if (!inv || !inv.contactId) return;

    const [c] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, inv.contactId))).limit(1);
    if (!c || !c.phone || !c.whatsappConsent) return;

    const text = `Habari ${c.displayName}!\n\nYour invoice *#${inv.number}* for *${fmtKES(inv.totalCents)}* has been generated.\n\nDate: ${inv.date}\nPayment Terms: Pay via M-Pesa or Bank.\n\nThank you for doing business with us!`;

    const res = await provider.sendMessage(c.phone, text);

    await db.insert(whatsappLogs).values({
      orgId,
      recipient: c.phone,
      targetType: "customer",
      messageType: "text",
      content: text,
      status: res.success ? "sent" : "failed",
      errorDetail: res.error,
      sentAt: now,
    });
  } else if (eventType === "payment.received" && data.amountCents) {
    const text = `🧾 *Payment Received!*\n\nAmount: *${fmtKES(data.amountCents)}*\nMethod: ${data.method || "M-Pesa"}\nRef: ${data.reference || "N/A"}\n\nThank you!`;
    const res = await provider.sendMessage("254712345678", text);

    await db.insert(whatsappLogs).values({
      orgId,
      recipient: "254712345678",
      targetType: "customer",
      messageType: "text",
      content: text,
      status: res.success ? "sent" : "failed",
      errorDetail: res.error,
      sentAt: now,
    });
  }
}

async function processRule(
  provider: any,
  rule: typeof whatsappRules.$inferSelect,
  orgId: number,
  data: Record<string, any>
): Promise<void> {
  const now = new Date().toISOString();

  // Resolve template text
  let messageText = "Zeno ERP Notification";
  if (rule.templateId) {
    const [tpl] = await db.select().from(whatsappTemplates).where(and(eq(whatsappTemplates.orgId, orgId), eq(whatsappTemplates.id, rule.templateId))).limit(1);
    if (tpl) messageText = tpl.templateText;
  }

  // Replace template placeholders
  messageText = messageText
    .replace(/{{customer_name}}/g, data.customerName || "Valued Customer")
    .replace(/{{number}}/g, data.number || data.invoiceNumber || "N/A")
    .replace(/{{amount}}/g, data.totalCents ? fmtKES(data.totalCents) : data.amountCents ? fmtKES(data.amountCents) : "0.00")
    .replace(/{{date}}/g, data.date || new Date().toISOString().slice(0, 10));

  if (rule.targetType === "company_group" && rule.groupId) {
    const res = await provider.sendMessage(rule.groupId, messageText);
    await db.insert(whatsappLogs).values({
      orgId,
      recipient: rule.groupId,
      targetType: "group",
      messageType: "text",
      content: messageText,
      status: res.success ? "sent" : "failed",
      errorDetail: res.error,
      sentAt: now,
    });
  } else if (rule.targetType === "tagged_staff" && rule.groupId) {
    // Look up assigned staff member phone number (e.g. for bill approval)
    const staffPhone = data.assignedStaffPhone || "254712345678";
    const staffName = data.assignedStaffName || "Accountant";

    const mentionText = `⚠️ *Approval Required*\n\n${messageText}\n\nAssigned to: @${staffPhone.replace(/\D/g, "")} (${staffName})`;

    const res = await provider.sendMessage(rule.groupId, mentionText, { mentions: [staffPhone] });
    await db.insert(whatsappLogs).values({
      orgId,
      recipient: rule.groupId,
      targetType: "tagged_staff",
      messageType: "text",
      content: mentionText,
      status: res.success ? "sent" : "failed",
      errorDetail: res.error,
      sentAt: now,
    });
  }
}
