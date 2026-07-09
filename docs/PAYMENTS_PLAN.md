# Payment Gateways — Implementation Plan

Goal: pluggable payment integrations (Kopo Kopo, M-Pesa Daraja, more later). The org
picks a gateway in Settings, enters that gateway's credentials, and from then on:

1. **Inbound** — when a customer pays an invoice (paybill/till/STK), the system detects
   it, records the payment, posts the journal, and flips the invoice status
   (open → partial → paid) automatically. No manual entry.
2. **Outbound** — pay a bill/expense out via the gateway (send money to a till/paybill/phone).

This mirrors the existing eTIMS `TaxDevice` pattern: one interface, swappable adapters,
gated behind per-org config. Nothing turns on until an org connects a gateway.

---

## 1. The core abstraction

`src/lib/payments/gateway.ts`

```ts
export type GatewayId = "mpesa_daraja" | "kopokopo";

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
  parseInbound(req: Request, secretConfig: GatewayConfig): Promise<InboundPayment | null>;
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
```

Adapters: `src/lib/payments/mpesaDaraja.ts`, `src/lib/payments/kopokopo.ts`.
Factory `getGateway(orgConfig)` returns the adapter the org selected.

---

## 2. Data model (new tables)

```
payment_gateways            -- one row per org (their chosen gateway + creds)
  id, org_id, gateway_id,   -- "mpesa_daraja" | "kopokopo"
  enabled,
  environment,              -- sandbox | production
  -- credentials (ENCRYPTED at rest, never sent to client):
  config_json,              -- { consumerKey, consumerSecret, shortcode, passkey, ... }
  created_at, updated_at

payment_events              -- every inbound webhook, raw + normalized (audit + idempotency)
  id, org_id, gateway_id,
  provider_ref UNIQUE,      -- dedupe: same M-Pesa receipt never processed twice
  amount_cents, payer_phone, payer_name, account_ref,
  status,                   -- received | matched | unmatched | applied | failed
  matched_document_id,      -- invoice it was applied to (nullable)
  payment_id,               -- our payments row once applied
  raw_json, created_at
```

Credentials encryption: AES-256-GCM with a server key (`PAYMENTS_ENC_KEY` in env).
Helper `encryptConfig()/decryptConfig()`. Client never receives secrets — Settings form
shows masked "•••• 1234" and only sends new values on change.

---

## 3. Matching engine — how a payment finds its invoice

`src/lib/payments/match.ts` — tries strategies in order, best-confidence wins:

1. **Account reference (deterministic).** Paybill and STK push both carry an
   `accountRef`. If we told the customer to use the invoice number (INV-0042) as the
   account, we match exactly. **This is the primary path — build the UX around it.**
2. **STK-initiated reference.** When *we* trigger the STK push from an invoice, we set
   `accountRef = invoice.number` ourselves → the callback is a guaranteed match.
3. **Phone + open amount.** Till payments (Buy Goods) carry no account field — match by
   payer phone (against contact phone) + an open invoice whose balance equals the amount.
   If exactly one candidate → auto-apply. If several/none → leave **unmatched** for a
   one-click manual link.

On a confident match → call existing `recordPayment()` (already posts the journal,
updates paid amount + status). On low confidence → surface in an "Unapplied payments"
inbox on the Banking/Payments page for one-click assignment.

Idempotency: `provider_ref UNIQUE` — a re-delivered webhook is ignored after the first.

---

## 4. Inbound flow (the customer's-client wish)

```
Customer pays paybill 400200, account = INV-0042
        │
  M-Pesa → gateway → POST /api/payments/webhook/[gatewayId]
        │
  1. verify signature/source (per gateway)
  2. parseInbound → InboundPayment
  3. insert payment_events (dedupe on provider_ref)
  4. match.ts → find invoice INV-0042
  5. recordPayment({ direction:"in", documentId, amountCents, method:"mpesa", ref })
        │
  Invoice: open → paid · journal posted · M-Pesa account debited
  (optional) notification + email receipt to customer
```

**Daraja specifics:** register C2B URLs (validation + confirmation) OR use STK Push
(Lipa na M-Pesa Express). Paybill exposes `BillRefNumber` = the account the customer
typed = invoice number. Callback is the confirmation endpoint.

**Kopo Kopo specifics:** subscribe `buygoods_transaction_received` webhook; till Buy
Goods has no account field, so till customers fall to phone+amount matching. STK push
(`/incoming_payments`) carries our ref → deterministic. Signed with `X-KopoKopo-Signature`.

---

## 5. Outbound flow (pay a bill)

Bill/expense detail → "Pay via M-Pesa" → `payOut()`:
- Daraja: B2C (to phone) or B2B (to paybill/till). Needs the org's B2C shortcode + initiator creds.
- Kopo Kopo: `/payments` (Pay Recipient).
Result → record vendor payment (existing path), post journal, clear AP.
Outbound is riskier (moves real money) → require explicit confirm + a role permission.

---

## 6. Settings UX (gateway picker)

Settings → **Payments** tab:
- Radio: **None · M-Pesa (Daraja) · Kopo Kopo**.
- On pick, show only that gateway's fields:
  - **Daraja:** Consumer Key, Consumer Secret, Shortcode (paybill/till), Passkey,
    environment (sandbox/production); B2C initiator name + security credential (optional, for payouts).
  - **Kopo Kopo:** Client ID, Client Secret, Till Number, API Key (webhook HMAC), environment.
- **"Test connection"** button → OAuth handshake, green tick.
- **"Register callbacks"** button → auto-registers our webhook URLs with the gateway.
- Show the **paybill + account-number instruction** the org should put on invoices
  ("Pay to Paybill 400200, Account: your invoice number") — this is what makes matching
  deterministic. Auto-add it to the invoice PDF footer when a gateway is connected.

Gated by a `payments` permission + `PAYMENTS_ENABLED`-style per-org flag (the
`payment_gateways.enabled` row). Off = today's behavior, fully manual.

---

## 7. Security notes

- Secrets encrypted at rest; decrypt only server-side in the adapter.
- Webhook endpoints verify authenticity every time (Daraja: source IP allowlist +
  shortcode check; Kopo Kopo: HMAC signature). Reject unsigned.
- Webhooks are public URLs → no auth cookie; rely on signature + `provider_ref` dedupe.
- Payouts require confirm + permission; never auto-send money.
- All raw payloads stored in `payment_events` for dispute/audit.

---

## 8. Build phases

- **Phase 1 — plumbing (no creds needed):** tables + migration, `PaymentGateway`
  interface, encryption helpers, Settings→Payments tab (store/mask creds), webhook route
  skeleton, `payment_events` + matching engine + "Unapplied payments" inbox. Wire matches
  to existing `recordPayment`.
- **Phase 2 — Daraja adapter:** STK push from invoice ("Request payment"), C2B register +
  confirmation webhook, sandbox test end-to-end. (Most Kenyan SMBs on paybill → do first.)
- **Phase 3 — Kopo Kopo adapter:** OAuth, incoming_payments (STK), buygoods webhook, Pay.
- **Phase 4 — outbound payouts** + email receipts + customer notifications.

Each adapter tested against its sandbox before production keys.

## 9. What's needed from the business

- Per gateway, a sandbox account: **Daraja** (developer.safaricom.co.ke) or **Kopo Kopo**
  (app.kopokopo.com) → keys.
- A public HTTPS callback URL — already have it (Vercel domain).
- For production Daraja: a real paybill/till + "Go Live" approval from Safaricom.
