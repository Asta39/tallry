"use server";

import { db, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg } from "@/lib/org";
import { encryptConfig, decryptConfig } from "@/lib/payments/crypto";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

export async function savePaymentGatewayAction(formData: FormData) {
  return withOrg(async () => {
    await requirePerm("settings");
    const o = await getOrg();

    const gatewayId = formData.get("gatewayId") as string;
    const environment = formData.get("environment") as string || "sandbox";
    const enabled = formData.get("enabled") === "on";

    if (!gatewayId) return { error: "Gateway ID is required" };

    let config: any = {};
    if (gatewayId === "mpesa_daraja") {
      config = {
        consumerKey: formData.get("consumerKey") as string,
        consumerSecret: formData.get("consumerSecret") as string,
        shortcode: formData.get("shortcode") as string,
        passkey: formData.get("passkey") as string,
        initiatorName: formData.get("initiatorName") as string,
        securityCredential: formData.get("securityCredential") as string,
      };
    } else if (gatewayId === "kopokopo") {
      config = {
        clientId: formData.get("clientId") as string,
        clientSecret: formData.get("clientSecret") as string,
        tillNumber: formData.get("tillNumber") as string,
        apiKey: formData.get("apiKey") as string,
      };
    }

    const existing = await db
      .select()
      .from(paymentGateways)
      .where(and(eq(paymentGateways.orgId, o.id), eq(paymentGateways.gatewayId, gatewayId)));

    if (existing.length > 0) {
      const oldConfig = decryptConfig(existing[0].configJson) || {};
      if (gatewayId === "mpesa_daraja") {
        config.consumerKey = config.consumerKey || oldConfig.consumerKey;
        config.consumerSecret = config.consumerSecret || oldConfig.consumerSecret;
        config.passkey = config.passkey || oldConfig.passkey;
        config.shortcode = config.shortcode || oldConfig.shortcode;
        config.initiatorName = config.initiatorName || oldConfig.initiatorName;
        config.securityCredential = config.securityCredential || oldConfig.securityCredential;
      } else if (gatewayId === "kopokopo") {
        config.clientId = config.clientId || oldConfig.clientId;
        config.clientSecret = config.clientSecret || oldConfig.clientSecret;
        config.apiKey = config.apiKey || oldConfig.apiKey;
        config.tillNumber = config.tillNumber || oldConfig.tillNumber;
      }
    }

    let configJson: string;
    try {
      configJson = encryptConfig(config);
    } catch (e: any) {
      return { error: e.message || "Failed to encrypt configuration. Check server logs." };
    }

    if (existing.length > 0) {
      await db.update(paymentGateways).set({
        enabled,
        environment,
        configJson,
        // Backfill for rows created before webhook auth existed
        webhookSecret: existing[0].webhookSecret || randomBytes(24).toString("hex"),
        updatedAt: new Date().toISOString(),
      }).where(eq(paymentGateways.id, existing[0].id));
    } else {
      await db.insert(paymentGateways).values({
        orgId: o.id,
        gatewayId,
        enabled,
        environment,
        configJson,
        // Authenticates inbound webhook callbacks (embedded in callback URL)
        webhookSecret: randomBytes(24).toString("hex"),
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/settings/payments");
    return { success: true };
  });
}
