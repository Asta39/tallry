import { PaymentGateway, GatewayOrgConfig, appBaseUrl } from "./gateway";
import { decryptConfig } from "./crypto";

const SANDBOX_BASE = "https://sandbox.safaricom.co.ke";
const PROD_BASE = "https://api.safaricom.co.ke";

export function getMpesaDarajaGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  const config = decryptConfig(orgConfig.configJson);
  const baseUrl = orgConfig.environment === "production" ? PROD_BASE : SANDBOX_BASE;
  const shortcode = config.shortcode;
  const passkey = config.passkey;
  const consumerKey = config.consumerKey;
  const consumerSecret = config.consumerSecret;

  async function getAccessToken(): Promise<string> {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) throw new Error("Failed to get M-Pesa token");
    const data = await res.json();
    return data.access_token;
  }

  return {
    id: "mpesa_daraja",

    async requestPayment(input) {
      const token = await getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
      // Daraja has no webhook signature — a per-org random token in the
      // callback URL is what authenticates inbound callbacks.
      const cbToken = orgConfig.webhookSecret ? `&token=${orgConfig.webhookSecret}` : "";

      const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline", // or CustomerBuyGoodsOnline
          Amount: Math.ceil(input.amountCents / 100),
          PartyA: input.phone.replace("+", ""),
          PartyB: shortcode,
          PhoneNumber: input.phone.replace("+", ""),
          CallBackURL: `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}${cbToken}`,
          AccountReference: input.accountRef.slice(0, 12),
          TransactionDesc: input.description.slice(0, 13),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`M-Pesa STK push failed: ${err}`);
      }

      const data = await res.json();
      if (!data.CheckoutRequestID) {
        throw new Error(`M-Pesa STK push returned no CheckoutRequestID: ${JSON.stringify(data)}`);
      }
      return { providerRef: data.CheckoutRequestID };
    },

    async payOut(input) {
      throw new Error("B2C Payouts not yet implemented for M-Pesa");
    },

    async parseInbound(req: Request) {
      const body = await req.json();
      // Safaricom nests STK push results under Body.stkCallback
      const callback = body?.Body?.stkCallback;
      if (!callback) return null;

      const requestRef = callback.CheckoutRequestID;

      if (callback.ResultCode !== 0) {
        // Payment failed or cancelled — surface so the pending event can be closed
        if (requestRef) return { failed: true as const, requestRef, raw: body };
        return null;
      }

      const items = callback.CallbackMetadata?.Item || [];
      const getVal = (name: string) => items.find((i: any) => i.Name === name)?.Value;

      const amount = getVal("Amount");
      const mpesaReceiptNumber = getVal("MpesaReceiptNumber");
      const phoneNumber = getVal("PhoneNumber");

      if (!mpesaReceiptNumber) return null;

      return {
        providerRef: String(mpesaReceiptNumber),
        amountCents: Math.round(Number(amount) * 100),
        payerPhone: phoneNumber ? String(phoneNumber) : undefined,
        requestRef,
        paidAt: new Date().toISOString(),
        raw: body,
      };
    }
  };
}
