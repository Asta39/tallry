import { db, smsSettings } from "@/db";
import { eq } from "drizzle-orm";
import { decryptConfig } from "@/lib/payments/crypto";
import { sendViaAdvanta } from "./advanta";

export interface SmsResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

export interface SmsProviderConfig {
  provider: string;
  config: any; // decrypted provider credentials
}

/** Kenyan MSISDN → 2547XXXXXXXX / 2541XXXXXXXX. Returns null if not a valid KE mobile. */
export function normalizeKePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let n = digits;
  if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.startsWith("7") || n.startsWith("1")) n = "254" + n;
  if (!/^254(7|1)\d{8}$/.test(n)) return null;
  return n;
}

export async function getOrgSmsConfig(orgId: number): Promise<SmsProviderConfig | null> {
  const [row] = await db.select().from(smsSettings).where(eq(smsSettings.orgId, orgId));
  if (!row || !row.enabled) return null;
  return { provider: row.provider, config: decryptConfig(row.configJson) };
}

export async function sendSms(cfg: SmsProviderConfig, to: string, message: string): Promise<SmsResult> {
  const phone = normalizeKePhone(to);
  if (!phone) return { ok: false, error: `Invalid Kenyan phone number: ${to}` };

  if (cfg.provider === "advanta") {
    return sendViaAdvanta(cfg.config, phone, message);
  }
  return { ok: false, error: `Unknown SMS provider: ${cfg.provider}` };
}
