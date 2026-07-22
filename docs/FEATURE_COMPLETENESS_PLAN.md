# Feature Completeness Plan (post-launch iteration)

_Reference document. Drafted 2026-07-13. These are the six items from the "full system" gap analysis, bucket 4 — ordered by expected real-world pain, not by size._

## Priority order and rationale

| # | Feature | Why this position | Effort |
|---|---|---|---|
| 1 | Unmatched payments UI | Real paybill traffic produces unmatched events **daily**; money invisible to staff is the worst kind of bug report | ~half session |
| 2 | C2B URL registration | Without it, walk-in paybill payments never reach the system at all — pairs directly with #1 | ~half session |
| 3 | Till/paybill payouts (Daraja B2B) | Suppliers with paybills are common; phone-only payouts force manual workarounds | ~1 session |
| 4 | Bank reconciliation | Highest accounting value, but statement import already covers the worst pain; the matching engine can wait for real user feedback | ~2 sessions |
| 5 | Multi-org / accountant polish | Existing module may already suffice — verify with a real accountant user before building | audit first |
| 6 | WhatsApp receipts | SMS already covers 100% of phones; WhatsApp is polish and has Meta-approval lead time | ~1 session + Meta approval wait |

---

## 1. Unmatched payments UI

**Problem.** `payment_events` rows with status `unmatched` / `amount_mismatch` / `failed` are invisible. Staff can't see money that arrived but didn't land on an invoice.

**Design.**
- New page `sales/payments/gateway-events` (link from Banking or Sales nav): table of events — date, payer phone/name, amount, gateway, accountRef typed by customer, status.
- Row actions:
  - **Apply to invoice** — picker of open invoices for the org (pre-filtered by fuzzy contact-phone match); applies via existing `recordPayment`, updates event to `applied`.
  - **Create contact + invoice** or **record as other income** for walk-in sales with no invoice.
  - **Dismiss** (e.g. test payment) with reason.
- Badge count of pending unmatched events in the sidebar.
- Amount-mismatch rows show requested vs received side by side.

**Reuses.** `matchPayment` heuristics for suggestions; `recordPayment`; event table already stores everything needed.

## 2. C2B URL registration

**Problem.** Customers paying the org's paybill directly (no STK push) generate confirmations only if Safaricom knows where to send them. Today those payments never reach Zeno.

**Design.**
- One-time per-org call to Daraja `/mpesa/c2b/v1/registerurl` with `ConfirmationURL` + `ValidationURL` pointing at the existing webhook (with org token).
- Button in Settings → Payment Gateways: "Register paybill callbacks" with status indicator (registered / not registered / failed).
- Webhook: extend `parseInbound` for the C2B confirmation payload shape (`TransID`, `TransAmount`, `BillRefNumber`, `MSISDN`, names). `BillRefNumber` is what the customer typed — feeds the existing invoice-number match; misses land in the unmatched queue (#1).
- Validation endpoint: accept-all initially (respond `ResultCode: 0`); tightening (reject unknown BillRef) is a later option org-by-org.

**Dependency.** Ship #1 first — C2B traffic multiplies unmatched events.

## 3. Till/paybill payouts (Daraja B2B)

**Problem.** `payOut` supports `destinationType: "phone"` only; paying a supplier's paybill or till errors out.

**Design.**
- Daraja `/mpesa/b2b/v1/paymentrequest`, CommandID `BusinessPayBill` (with `AccountReference`) or `BusinessBuyGoods` (till).
- Same initiator credentials as B2C (already in gateway config); same pending-event → result-callback reconcile pipeline (`Result.ConversationID` keying works identically).
- UI already has the destination-type selector — remove the "not supported" error path, add account-number field for paybill destinations.
- Result callback parse: same `Result` envelope; small additions to the existing B2C parser.

**Reuses.** Nearly everything — this is ~80% plumbing already built during payouts phase.

## 4. Bank reconciliation

**Problem.** Statement import (M-Pesa) exists; matching imported lines against ledger entries is manual.

**Design (incremental, two stages).**
- **Stage A — suggestions:** for each unreconciled bank line, score candidate ledger entries by amount (exact), date (±3 days), reference/phone similarity. One-click confirm per suggestion; bulk-confirm for exact amount+date matches. `reconciliations` table linking bank line ↔ journal entry.
- **Stage B — rules:** user-defined rules ("PAYBILL 888880 → Rent expense") auto-categorize recurring lines. Only build after Stage A usage proves demand.
- Reconciliation status column on Banking screen; unreconciled count badge.

**Note.** Categorization logic exists (`src/lib/categorization.ts`) — audit and reuse before writing anything new.

## 5. Multi-org / accountant portal polish

**Approach: audit before building.** The accountant module exists (`src/app/(app)/accountant`). Steps:
1. Walk the flows end-to-end as a real accountant would: invited to 3 orgs, switching between them, permission boundaries, report access.
2. File concrete gaps (org switcher UX, cross-org dashboard, invite flow, per-org role differences).
3. Only then scope work — likely small fixes, not a rebuild.

**Known question to answer:** can one user own one org AND be staff in others simultaneously (getOrg resolution order suggests owner-org wins — verify this is the desired behavior).

## 6. WhatsApp receipts

**Problem/opportunity.** SMS covers every phone; WhatsApp adds richer delivery (PDF into the chat) for smartphone users and is cheaper per message than SMS at scale in some tiers.

**Design.**
- Meta WhatsApp Business Platform via BSP (360dialog or Twilio — pick by price; direct Meta Cloud API is also viable and cheapest).
- One approved utility template: `"{{amount}} received for {{invoice}}. Receipt: {{link}} — {{business}}"` — same payload as SMS, reusing the receipt-token primitive.
- Fallback chain per receipt: WhatsApp → (undelivered in N minutes) → SMS. Delivery status via WhatsApp webhooks.
- Org setting: channel preference (SMS only / WhatsApp first).

**Lead times.** Meta business verification + template approval takes days-to-weeks — **start the Meta paperwork early**, build last.

---

## Suggested sequencing with other tracks

Interleave with monetization (see `MONETIZATION_PLAN.md`): items 1–2 here are launch-hygiene and worth doing **before** charging money (paying customers hitting invisible-money bugs is churn); items 3–6 are genuinely post-launch.

```
Launch prep:   Monetization 1-2  →  Features 1-2  →  Monetization 3-4  →  LAUNCH
Post-launch:   Features 3  →  5 (audit)  →  4  →  6
```
