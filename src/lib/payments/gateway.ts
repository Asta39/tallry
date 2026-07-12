export type GatewayId = "mpesa_daraja" | "kopokopo";

import { getMpesaDarajaGateway } from "./mpesaDaraja";
import { getKopoKopoGateway } from "./kopokopo";

export interface GatewayOrgConfig {
  orgId?: number;
  gatewayId: string;
  configJson: string | null;
  environment: string;
  webhookSecret?: string | null;
}

export interface PaymentGateway {
  id: GatewayId;
  /** Prompt a customer's phone to pay (STK push / incoming payment). */
  requestPayment(input: {
    phone: string;
    amountCents: number;
    accountRef: string;   // invoice number — echoed back in the callback
    description: string;
    payerName?: string;
    payerEmail?: string;
  }): Promise<{ providerRef: string }>;
  /** Send money out (pay a bill). */
  payOut(input: {
    destination: string;  // phone | till | paybill
    destinationType: "phone" | "till" | "paybill";
    amountCents: number;
    accountRef?: string;
    reason: string;
  }): Promise<{ providerRef: string }>;
  /** Verify + normalize an inbound webhook/callback into a common shape.
   *  Throws on signature verification failure; returns null for
   *  unrecognized payloads. */
  parseInbound(req: Request): Promise<InboundResult | null>;
}

export interface InboundPayment {
  providerRef: string;      // idempotency key (M-Pesa receipt / KK id)
  amountCents: number;
  payerPhone?: string;
  payerName?: string;
  accountRef?: string;      // what the customer typed (invoice number, if paybill)
  /** Provider ref of the originating request (e.g. Daraja CheckoutRequestID),
   *  used to reconcile against the pending event created at push time. */
  requestRef?: string;
  paidAt: string;
  raw: unknown;             // full payload, stored for audit
}

/** A callback for a request that failed or was cancelled by the customer. */
export interface InboundFailure {
  failed: true;
  requestRef: string;
  raw: unknown;
}

export type InboundResult = InboundPayment | InboundFailure;

export function isInboundFailure(r: InboundResult): r is InboundFailure {
  return (r as InboundFailure).failed === true;
}

export function appBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set — cannot build gateway callback URLs");
  return url.replace(/\/$/, "");
}

export function getGateway(orgConfig: GatewayOrgConfig): PaymentGateway {
  if (orgConfig.gatewayId === "mpesa_daraja") {
    return getMpesaDarajaGateway(orgConfig);
  }
  if (orgConfig.gatewayId === "kopokopo") {
    return getKopoKopoGateway(orgConfig);
  }
  throw new Error(`Unknown gateway: ${orgConfig.gatewayId}`);
}
