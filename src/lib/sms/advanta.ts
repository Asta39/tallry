import type { SmsResult } from "./index";

const ADVANTA_URL = "https://quicksms.advantasms.com/api/services/sendsms/";

/** Advanta (quicksms.advantasms.com) bulk SMS. Config: apiKey, partnerId, senderId. */
export async function sendViaAdvanta(
  config: { apiKey?: string; partnerId?: string; senderId?: string },
  phone: string,
  message: string
): Promise<SmsResult> {
  if (!config.apiKey || !config.partnerId || !config.senderId) {
    return { ok: false, error: "Advanta SMS not fully configured (apiKey, partnerId, senderId required)" };
  }

  try {
    // Without a timeout, one slow/hanging Advanta response stalls whatever
    // called sendSms indefinitely — a real problem for the payout
    // reconciliation loop, which sends one of these per confirmed payout in
    // sequence and would otherwise never finish (or time out the whole cron).
    const res = await fetch(ADVANTA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: config.apiKey,
        partnerID: config.partnerId,
        shortcode: config.senderId,
        mobile: phone,
        message,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const text = await res.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { /* non-JSON error body */ }

    // Advanta: { responses: [{ "response-code": 200, "messageid": ..., "mobile": ... }] }
    const first = data?.responses?.[0];
    const code = first?.["response-code"] ?? data?.["response-code"];

    if (res.ok && Number(code) === 200) {
      return { ok: true, providerRef: String(first?.messageid ?? "") };
    }
    return { ok: false, error: `Advanta error (${res.status}): ${first?.["response-description"] || text.slice(0, 200)}` };
  } catch (e: any) {
    return { ok: false, error: e.message || "Advanta request failed" };
  }
}
