export type GatewayId = "mpesa_daraja" | "kopokopo";

import { getMpesaDarajaGateway } from "./mpesaDaraja";
import { getKopoKopoGateway } from "./kopokopo";

export interface PaymentGateway {
  id: GatewayId;
  /** Prompt a customer's phone to pay (STK push / incoming payment). */
  requestPayment(input: {
    phone: string;
    amountCents: number;
    accountRef: string;   // invoice number — echoed back in the callback
    description: string;
  }): Promise<{ providerRef: string }>;
  /** Send money out (pay a bill). */
  payOut(input: {
    destination: string;  // phone | till | paybill
    destinationType: "phone" | "till" | "paybill";
    amountCents: number;
    accountRef?: string;
    reason: string;
  }): Promise<{ providerRef: string }>;
  /** Verify + normalize an inbound webhook/callback into a common shape. */
  parseInbound(req: Request, secretConfig: any): Promise<InboundPayment | null>;
}

export interface InboundPayment {
  providerRef: string;      // idempotency key (M-Pesa receipt / KK id)
  amountCents: number;
  payerPhone?: string;
  payerName?: string;
  accountRef?: string;      // what the customer typed (invoice number, if paybill)
  paidAt: string;
  raw: unknown;             // full payload, stored for audit
}

// Factory will be implemented when adapters are added
export function getGateway(orgConfig: { gatewayId: string; configJson: string | null; environment: string }): PaymentGateway {
  if (orgConfig.gatewayId === "mpesa_daraja") {
    return getMpesaDarajaGateway(orgConfig);
  }
  if (orgConfig.gatewayId === "kopokopo") {
    return getKopoKopoGateway(orgConfig);
  }
  throw new Error(`Unknown gateway: ${orgConfig.gatewayId}`);
}
