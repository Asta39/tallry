import { db, whatsappConfigs } from "@/db";
import { eq } from "drizzle-orm";
import { WhatsAppProvider } from "./types";
import { BaileysProvider } from "./providers/baileys";
import { MetaCloudProvider } from "./providers/metacloud";

/**
 * Dynamically resolves and instantiates the configured WhatsApp provider for an organization.
 */
export async function getWhatsAppProvider(orgId: number): Promise<{ provider: WhatsAppProvider; paused: boolean }> {
  const [cfg] = await db
    .select()
    .from(whatsappConfigs)
    .where(eq(whatsappConfigs.orgId, orgId))
    .limit(1);

  if (!cfg) {
    // Default fallback: Baileys provider
    return {
      provider: new BaileysProvider(orgId),
      paused: false,
    };
  }

  if (cfg.provider === "meta_cloud") {
    return {
      provider: new MetaCloudProvider(cfg.apiKey, cfg.phoneNumberId),
      paused: cfg.paused,
    };
  }

  // Baileys or other WebSockets provider
  return {
    provider: new BaileysProvider(orgId, cfg.sessionState),
    paused: cfg.paused,
  };
}
