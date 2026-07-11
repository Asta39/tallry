import { PaymentGateway, InboundPayment } from "./gateway";
import { decryptConfig } from "./crypto";

const SANDBOX_BASE = "https://sandbox.kopokopo.com";
const PROD_BASE = "https://app.kopokopo.com";

export function getKopoKopoGateway(orgConfig: any): PaymentGateway {
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
            first_name: "Customer",
            last_name: "Tallry",
            phone_number: input.phone,
            email: "support@tallry.com"
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
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/kopokopo?orgId=${orgConfig.orgId}`
          }
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Kopo Kopo STK push failed: ${err}`);
      }

      // Kopo Kopo returns 201 Created with a Location header pointing to the resource
      const location = res.headers.get("Location");
      return { providerRef: location || "kopokopo_stk_push" };
    },

    async payOut(input) {
      throw new Error("Kopo Kopo Payouts not yet implemented");
    },

    async parseInbound(req: Request) {
      // In a real app we would verify the HMAC signature from the X-KopoKopo-Signature header using config.apiKey
      
      const body = await req.json();
      
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
