"use server";

import { db, whatsappConfigs, whatsappTemplates, whatsappGroups, whatsappRules, whatsappLogs } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { currentOrgId, withOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";
import { getWhatsAppProvider } from "@/lib/whatsapp/factory";

export async function getWhatsAppSettingsData() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const [config] = await db.select().from(whatsappConfigs).where(eq(whatsappConfigs.orgId, orgId)).limit(1);
    const templates = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.orgId, orgId));
    const groups = await db.select().from(whatsappGroups).where(eq(whatsappGroups.orgId, orgId));
    const rules = await db.select().from(whatsappRules).where(eq(whatsappRules.orgId, orgId));
    const logs = await db.select().from(whatsappLogs).where(eq(whatsappLogs.orgId, orgId)).orderBy(desc(whatsappLogs.sentAt)).limit(50);

    return {
      config: config || { provider: "baileys", apiKey: "", phoneNumberId: "", paused: false, sessionState: null },
      templates,
      groups,
      rules,
      logs,
    };
  });
}

export async function saveWhatsAppConfigAction(formData: FormData) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const provider = String(formData.get("provider") || "baileys");
    const apiKey = String(formData.get("apiKey") || "").trim();
    const phoneNumberId = String(formData.get("phoneNumberId") || "").trim();
    const now = new Date().toISOString();

    const [existing] = await db.select().from(whatsappConfigs).where(eq(whatsappConfigs.orgId, orgId)).limit(1);

    if (existing) {
      await db
        .update(whatsappConfigs)
        .set({ provider, apiKey, phoneNumberId, updatedAt: now })
        .where(eq(whatsappConfigs.id, existing.id));
    } else {
      await db.insert(whatsappConfigs).values({
        orgId,
        provider,
        apiKey,
        phoneNumberId,
        paused: false,
        updatedAt: now,
      });
    }

    revalidatePath("/settings/whatsapp");
    return { success: true };
  });
}

export async function toggleWhatsAppPauseAction(paused: boolean) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    await db.update(whatsappConfigs).set({ paused, updatedAt: new Date().toISOString() }).where(eq(whatsappConfigs.orgId, orgId));
    revalidatePath("/settings/whatsapp");
    return { success: true };
  });
}

export async function saveWhatsAppTemplateAction(name: string, key: string, templateText: string) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    await db.insert(whatsappTemplates).values({
      orgId,
      name,
      key,
      templateText,
      active: true,
    });
    revalidatePath("/settings/whatsapp");
    return { success: true };
  });
}

export async function saveWhatsAppGroupAction(groupId: string, name: string, description?: string) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    await db.insert(whatsappGroups).values({
      orgId,
      groupId,
      name,
      description: description || null,
    });
    revalidatePath("/settings/whatsapp");
    return { success: true };
  });
}

export async function saveWhatsAppRuleAction(eventType: string, targetType: string, groupId?: string, templateId?: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    await db.insert(whatsappRules).values({
      orgId,
      eventType,
      targetType,
      groupId: groupId || null,
      templateId: templateId || null,
      active: true,
    });
    revalidatePath("/settings/whatsapp");
    return { success: true };
  });
}

export async function sendTestWhatsAppAction(recipient: string, text: string) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const { provider, paused } = await getWhatsAppProvider(orgId);

    if (paused) return { error: "WhatsApp service is currently paused for your organization." };

    const res = await provider.sendMessage(recipient, text);

    await db.insert(whatsappLogs).values({
      orgId,
      recipient,
      targetType: recipient.includes("@g.us") ? "group" : "customer",
      messageType: "text",
      content: text,
      status: res.success ? "sent" : "failed",
      errorDetail: res.error,
      sentAt: new Date().toISOString(),
    });

    revalidatePath("/settings/whatsapp");
    return res;
  });
}
