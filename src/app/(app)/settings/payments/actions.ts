"use server";

import { db, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg } from "@/lib/org";
import { encryptConfig } from "@/lib/payments/crypto";
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
      };
    } else if (gatewayId === "kopokopo") {
      config = {
        clientId: formData.get("clientId") as string,
        clientSecret: formData.get("clientSecret") as string,
        tillNumber: formData.get("tillNumber") as string,
        apiKey: formData.get("apiKey") as string,
      };
    }

    let configJson: string;
    try {
      configJson = encryptConfig(config);
    } catch (e: any) {
      return { error: e.message || "Failed to encrypt configuration. Check server logs." };
    }

    const existing = await db
      .select()
      .from(paymentGateways)
      .where(and(eq(paymentGateways.orgId, o.id), eq(paymentGateways.gatewayId, gatewayId)));

    if (existing.length > 0) {
      await db.update(paymentGateways).set({
        enabled,
        environment,
        configJson: configJson || existing[0].configJson,
        updatedAt: new Date().toISOString(),
      }).where(eq(paymentGateways.id, existing[0].id));
    } else {
      await db.insert(paymentGateways).values({
        orgId: o.id,
        gatewayId,
        enabled,
        environment,
        configJson,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/settings/payments");
    return { success: true };
  });
}
