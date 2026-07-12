import crypto from "crypto";
import { PaymentGateway, GatewayOrgConfig, appBaseUrl } from "./gateway";
import { decryptConfig } from "./crypto";

const SANDBOX_BASE = "https://sandbox.kopokopo.com";
const PROD_BASE = "https://app.kopokopo.com";

function resourceIdFromLocation(location: string): string {
  const segments = new URL(location).pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] || location;
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
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) throw new Error("Failed to get Kopo Kopo token");
    const data = await res.json();
    return data.access_token;
  }

  return {
    id: "kopokopo",

    async requestPayment(input) {
      const token = await getAccessToken();
      const [firstName, ...rest] = (input.payerName || "Customer").trim().split(/\s+/);

      // Initiate STK Push via Kopo Kopo
      const res = await fetch(`${baseUrl}/api/v1/incoming_payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          payment_channel: "M-PESA STK Push",
          till_number: config.tillNumber,
          subscriber: {
            first_name: firstName,
            last_name: rest.join(" ") || firstName,
            phone_number: input.phone,
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

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Kopo Kopo STK push failed: ${err}`);
      }

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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          type: "mobile_wallet",
          pay_recipient: {
            first_name: "Vendor",
            last_name: input.accountRef || "Payout",
            phone_number: input.destination,
            network: "Safaricom",
          },
        }),
      });
      if (!recipientRes.ok) {
        const err = await recipientRes.text();
        throw new Error(`Kopo Kopo recipient creation failed: ${err}`);
      }
      const recipientLocation = recipientRes.headers.get("Location");
      if (!recipientLocation) throw new Error("Kopo Kopo recipient creation returned no Location header");
      const recipientRef = resourceIdFromLocation(recipientLocation);

      // 2. Initiate the payment to that recipient
      const payRes = await fetch(`${baseUrl}/api/v1/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
      if (!payRes.ok) {
        const err = await payRes.text();
        throw new Error(`Kopo Kopo payout failed: ${err}`);
      }
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
