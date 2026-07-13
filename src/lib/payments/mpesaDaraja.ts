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
      if (!config.initiatorName || !config.securityCredential) {
        throw new Error("M-Pesa payouts require Initiator Name and Security Credential — add them in Settings → Payment Gateways");
      }
      if (input.amountCents % 100 !== 0) {
        throw new Error("M-Pesa payouts must be a whole shilling amount");
      }
      if (input.destinationType === "paybill" && !input.accountNumber) {
        throw new Error("Paybill payouts require an account number");
      }

      const token = await getAccessToken();
      const cbToken = orgConfig.webhookSecret ? `&token=${orgConfig.webhookSecret}` : "";
      const resultUrl = `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}${cbToken}`;

      const common = {
        SecurityCredential: config.securityCredential,
        Amount: input.amountCents / 100,
        PartyA: shortcode,
        Remarks: input.reason.slice(0, 100),
        QueueTimeOutURL: resultUrl,
        ResultURL: resultUrl,
      };

      // Phone → B2C; till/paybill → B2B. Result callbacks share the same
      // Result envelope, so the reconcile pipeline is identical.
      const isB2C = input.destinationType === "phone";
      const endpoint = isB2C ? "/mpesa/b2c/v1/paymentrequest" : "/mpesa/b2b/v1/paymentrequest";
      const body = isB2C
        ? {
            ...common,
            InitiatorName: config.initiatorName,
            CommandID: "BusinessPayment",
            PartyB: input.destination.replace("+", ""),
            Occasion: (input.accountRef || "").slice(0, 100),
          }
        : {
            ...common,
            Initiator: config.initiatorName,
            CommandID: input.destinationType === "paybill" ? "BusinessPayBill" : "BusinessBuyGoods",
            SenderIdentifierType: "4",
            RecieverIdentifierType: "4", // Daraja's own spelling
            PartyB: input.destination.replace(/\D/g, ""),
            AccountReference: (input.accountNumber || input.accountRef || "").slice(0, 13),
          };

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`M-Pesa ${isB2C ? "B2C" : "B2B"} payout failed: ${err}`);
      }

      const data = await res.json();
      if (!data.ConversationID) {
        throw new Error(`M-Pesa payout returned no ConversationID: ${JSON.stringify(data)}`);
      }
      return { providerRef: data.ConversationID };
    },

    async registerC2b() {
      const token = await getAccessToken();
      const cbToken = orgConfig.webhookSecret ? `&token=${orgConfig.webhookSecret}` : "";
      const base = `${appBaseUrl()}/api/payments/webhook/mpesa_daraja?orgId=${orgConfig.orgId}${cbToken}`;

      const res = await fetch(`${baseUrl}/mpesa/c2b/v1/registerurl`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ShortCode: shortcode,
          ResponseType: "Completed", // if validation URL is unreachable, complete the payment anyway
          ConfirmationURL: base,
          ValidationURL: `${base}&c2b=validation`,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`C2B URL registration failed: ${err}`);
      }
      const data = await res.json().catch(() => ({}));
      // Daraja replies ResponseDescription: "success" on OK
      if (data.ResponseDescription && !/success/i.test(String(data.ResponseDescription))) {
        throw new Error(`C2B URL registration rejected: ${JSON.stringify(data)}`);
      }
    },

    async parseInbound(req: Request) {
      const body = await req.json();

      // C2B confirmation: customer paid the paybill directly (no STK push)
      if (body?.TransID && body?.TransAmount !== undefined) {
        const name = [body.FirstName, body.MiddleName, body.LastName].filter(Boolean).join(" ");
        return {
          providerRef: String(body.TransID),
          amountCents: Math.round(Number(body.TransAmount) * 100),
          payerPhone: body.MSISDN ? String(body.MSISDN) : undefined,
          payerName: name || undefined,
          accountRef: body.BillRefNumber ? String(body.BillRefNumber) : undefined,
          paidAt: new Date().toISOString(),
          raw: body,
        };
      }

      // B2C payout results arrive under Result (ResultURL/QueueTimeOutURL)
      const result = body?.Result;
      if (result) {
        const requestRef = result.ConversationID;
        if (!requestRef) return null;

        if (result.ResultCode !== 0) {
          return { failed: true as const, requestRef, raw: body };
        }

        const params = result.ResultParameters?.ResultParameter || [];
        const getParam = (key: string) => params.find((p: any) => p.Key === key)?.Value;
        const amount = getParam("TransactionAmount");
        const receipt = getParam("TransactionReceipt") || result.TransactionID;
        if (!receipt) return null;

        return {
          providerRef: String(receipt),
          direction: "out" as const,
          amountCents: Math.round(Number(amount) * 100),
          payerName: getParam("ReceiverPartyPublicName") ? String(getParam("ReceiverPartyPublicName")) : undefined,
          requestRef,
          paidAt: new Date().toISOString(),
          raw: body,
        };
      }

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
