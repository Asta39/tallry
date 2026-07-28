import crypto from "crypto";
import { PaymentGateway, GatewayOrgConfig, appBaseUrl } from "./gateway";
import { decryptConfig } from "./crypto";

const SANDBOX_BASE = "https://sandbox.kopokopo.com";
const PROD_BASE = "https://app.kopokopo.com";

// Kopo Kopo documents User-Agent as a required header, and their edge rejects
// requests without one with a bodyless 403. Node's fetch sends no User-Agent by
// default, so it has to be set explicitly on every call.
const USER_AGENT = "Zeno/1.0 (+https://zeno.co.ke)";

function resourceIdFromLocation(location: string): string {
  const segments = new URL(location).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || location;
}

/** Kopo Kopo wants E.164 (+2547XXXXXXXX); users type 07XX / 7XX / 2547XX. */
function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/[^\d]/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

/**
 * Kopo Kopo returns failures with an empty body more often than not — a bodyless
 * 403 from their WAF looks identical to a real authorization failure. Surfacing
 * the status, content-type and any body fragment is the difference between a
 * diagnosable error and a dead end.
 */
async function describeFailure(res: Response, what: string): Promise<Error> {
  let body = "";
  try {
    body = (await res.text()).trim();
  } catch {
    /* body already consumed or unreadable */
  }
  const ctype = res.headers.get("content-type") ?? "none";
  const detail = body ? body.slice(0, 400) : `empty response (content-type: ${ctype})`;
  const hint =
    res.status === 403 && !body
      ? " — a bodyless 403 usually means the request was blocked at the edge (User-Agent/IP) or this app isn't enabled for payouts in the Kopo Kopo dashboard."
      : "";
  return new Error(`${what} (HTTP ${res.status}): ${detail}${hint}`);
}

export function getKopoKopoGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  const config = decryptConfig(orgConfig.configJson);
  const baseUrl = orgConfig.environment === "production" ? PROD_BASE : SANDBOX_BASE;

  async function getAccessToken(): Promise<string> {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const res = await fetch(`${baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: params.toString(),
    });

    if (!res.ok) throw await describeFailure(res, "Kopo Kopo token request failed");
    const data = await res.json();
    return data.access_token;
  }

  const authHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  });

  return {
    id: "kopokopo",

    async requestPayment(input) {
      const token = await getAccessToken();
      const [firstName, ...rest] = (input.payerName || "Customer").trim().split(/\s+/);

      // Initiate STK Push via Kopo Kopo
      const res = await fetch(`${baseUrl}/api/v1/incoming_payments`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          payment_channel: "M-PESA STK Push",
          till_number: config.tillNumber,
          subscriber: {
            first_name: firstName,
            last_name: rest.join(" ") || firstName,
            phone_number: normalizePhone(input.phone),
            ...(input.payerEmail ? { email: input.payerEmail } : {}),
          },
          amount: {
            currency: "KES",
            value: Math.ceil(input.amountCents / 100)
          },
          metadata: {
            accountRef: input.accountRef,
            description: input.description,
            orgId: orgConfig.orgId
          },
          _links: {
            callback_url: `${appBaseUrl()}/api/payments/webhook/kopokopo?orgId=${orgConfig.orgId}`
          }
        }),
      });

      if (!res.ok) throw await describeFailure(res, "Kopo Kopo STK push failed");

      // Kopo Kopo returns 201 Created with a Location header pointing to the
      // resource; its last path segment is the resource id echoed back as
      // data.id in the status callback — store that so we can reconcile.
      const location = res.headers.get("Location");
      if (!location) {
        throw new Error("Kopo Kopo STK push succeeded but returned no Location header");
      }
      return { providerRef: resourceIdFromLocation(location) };
    },

    async payOut(input) {
      if (input.destinationType !== "phone") {
        throw new Error("Only phone (mobile wallet) payouts are supported for Kopo Kopo currently");
      }
      const token = await getAccessToken();

      // 1. Create (or re-create) a mobile-wallet recipient
      const recipientRes = await fetch(`${baseUrl}/api/v1/pay_recipients`, {
        method: "POST",
        headers: authHeaders(token),
        // Mobile-wallet recipients use camelCase keys (unlike the snake_case
        // subscriber block on incoming_payments) — snake_case is silently
        // dropped and the request fails validation.
        body: JSON.stringify({
          type: "mobile_wallet",
          pay_recipient: {
            firstName: "Vendor",
            lastName: input.accountRef || "Payout",
            phoneNumber: normalizePhone(input.destination),
            network: "Safaricom",
          },
        }),
      });
      if (!recipientRes.ok) throw await describeFailure(recipientRes, "Kopo Kopo recipient creation failed");
      const recipientLocation = recipientRes.headers.get("Location");
      if (!recipientLocation) throw new Error("Kopo Kopo recipient creation returned no Location header");
      const recipientRef = resourceIdFromLocation(recipientLocation);

      // 2. Initiate the payment to that recipient
      const payRes = await fetch(`${baseUrl}/api/v1/payments`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          destination_type: "mobile_wallet",
          destination_reference: recipientRef,
          amount: {
            currency: "KES",
            value: Math.floor(input.amountCents / 100),
          },
          description: input.reason.slice(0, 255),
          metadata: {
            accountRef: input.accountRef,
            orgId: orgConfig.orgId,
          },
          _links: {
            callback_url: `${appBaseUrl()}/api/payments/webhook/kopokopo?orgId=${orgConfig.orgId}`,
          },
        }),
      });
      if (!payRes.ok) throw await describeFailure(payRes, "Kopo Kopo payout failed");
      const payLocation = payRes.headers.get("Location");
      if (!payLocation) throw new Error("Kopo Kopo payout returned no Location header");
      return { providerRef: resourceIdFromLocation(payLocation) };
    },

    async parseInbound(req: Request) {
      // Kopo Kopo signs every webhook: X-KopoKopo-Signature is
      // HMAC-SHA256(rawBody, apiKey) hex-encoded.
      const rawBody = await req.text();
      const signature = req.headers.get("X-KopoKopo-Signature");
      if (!config.apiKey) {
        throw new Error("Kopo Kopo apiKey not configured — cannot verify webhook signature");
      }
      if (!signature) {
        throw new Error("Missing X-KopoKopo-Signature header");
      }
      const expected = crypto.createHmac("sha256", config.apiKey).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signature, "utf8");
      const expBuf = Buffer.from(expected, "utf8");
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error("Invalid Kopo Kopo webhook signature");
      }

      const body = JSON.parse(rawBody);

      // STK push / payout status callbacks use the data.type envelope
      // (unlike webhook subscriptions which use topic).
      if (body.data?.type === "incoming_payment") {
        const attrs = body.data.attributes || {};
        const resource = attrs.event?.resource;
        const requestRef = body.data.id;
        if (attrs.status !== "Success" || !resource) {
          return requestRef ? { failed: true as const, requestRef, raw: body } : null;
        }
        return {
          providerRef: resource.reference,
          amountCents: Math.round(Number(resource.amount) * 100),
          payerPhone: resource.sender_phone_number,
          payerName: [resource.sender_first_name, resource.sender_last_name].filter(Boolean).join(" ") || undefined,
          accountRef: attrs.metadata?.accountRef,
          requestRef,
          paidAt: resource.origination_time || new Date().toISOString(),
          raw: body,
        };
      }

      if (body.data?.type === "payment") {
        const attrs = body.data.attributes || {};
        const resource = attrs.event?.resource;
        const requestRef = body.data.id;
        if (attrs.status !== "Transferred" || !resource) {
          return requestRef ? { failed: true as const, requestRef, raw: body } : null;
        }
        return {
          providerRef: resource.reference || `kk_pay_${requestRef}`,
          direction: "out" as const,
          amountCents: Math.round(Number(resource.amount) * 100),
          requestRef,
          paidAt: resource.origination_time || new Date().toISOString(),
          raw: body,
        };
      }

      if (body.topic === "buygoods_transaction_received") {
        const event = body.event;
        const resource = event.resource;

        return {
          providerRef: resource.reference, // e.g., M-Pesa receipt "QK..."
          amountCents: Math.round(Number(resource.amount) * 100),
          payerPhone: resource.sender_phone_number,
          payerName: `${resource.sender_first_name} ${resource.sender_last_name}`,
          accountRef: resource.till_number, // for Buy Goods it's usually just the till
          paidAt: resource.origination_time,
          raw: body,
        };
      }

      if (body.topic === "b2b_transaction_received" || body.topic === "m_pesa_payment_received") {
        // b2b or paybill format
        const resource = body.event.resource;
        return {
          providerRef: resource.reference,
          amountCents: Math.round(Number(resource.amount) * 100),
          payerPhone: resource.sender_phone_number,
          payerName: `${resource.sender_first_name} ${resource.sender_last_name}`,
          accountRef: resource.system_reference || resource.account_number,
          paidAt: resource.origination_time,
          raw: body,
        };
      }

      return null;
    }
  };
}
