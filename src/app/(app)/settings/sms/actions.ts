"use server";

import { db, smsSettings } from "@/db";
import { eq } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg } from "@/lib/org";
import { encryptConfig, decryptConfig } from "@/lib/payments/crypto";
import { getOrgSmsConfig, sendSms } from "@/lib/sms";
import { revalidatePath } from "next/cache";

export async function saveSmsSettingsAction(formData: FormData) {
  return withOrg(async () => {
    await requirePerm("settings");
    const o = await getOrg();

    const enabled = formData.get("enabled") === "on";
    const config: any = {
      apiKey: formData.get("apiKey") as string,
      partnerId: formData.get("partnerId") as string,
      senderId: formData.get("senderId") as string,
    };

    const [existing] = await db.select().from(smsSettings).where(eq(smsSettings.orgId, o.id));

    if (existing) {
      const old = decryptConfig(existing.configJson) || {};
      config.apiKey = config.apiKey || old.apiKey;
      config.partnerId = config.partnerId || old.partnerId;
      config.senderId = config.senderId || old.senderId;
    }

    let configJson: string;
    try {
      configJson = encryptConfig(config);
    } catch (e: any) {
      return { error: e.message || "Failed to encrypt configuration" };
    }

    if (existing) {
      await db.update(smsSettings).set({
        enabled,
        configJson,
        updatedAt: new Date().toISOString(),
      }).where(eq(smsSettings.id, existing.id));
    } else {
      await db.insert(smsSettings).values({
        orgId: o.id,
        provider: "advanta",
        enabled,
        configJson,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/settings/sms");
    return { success: true };
  });
}

export async function sendTestSmsAction(phone: string) {
  return withOrg(async () => {
    await requirePerm("settings");
    const o = await getOrg();

    const cfg = await getOrgSmsConfig(o.id);
    if (!cfg) return { error: "SMS is not enabled — save your Advanta settings first" };

    const result = await sendSms(cfg, phone, `Test message from ${o.name || "Zeno"} — SMS receipts are working.`);
    if (!result.ok) return { error: result.error || "Send failed" };
    return { success: true };
  });
}
