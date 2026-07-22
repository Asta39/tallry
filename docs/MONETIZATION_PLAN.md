# Zeno Monetization Plan

_Reference document. Drafted 2026-07-13. Prices are working hypotheses — validate with the first 10 target customers before building step 2._

## Core constraint

M-Pesa has no auto-renewing subscription primitive and card penetration among Kenyan SMEs is too low to matter. Therefore: **no Stripe-style recurring billing**. The model is **prepaid terms with nudges** — the pattern Kenyans already use for airtime, DSTV, and home Wi-Fi.

## Model

**Prepaid subscription, dogfooding our own rails.** Zeno itself runs as a platform org with its own Daraja/Kopo Kopo gateway config. A business paying its subscription is just an STK push through the existing, tested gateway code (pending event → webhook confirm → apply). No new payment infrastructure; the billing system doubles as a product demo.

## Plans

| | Free | Standard (~KES 1,500/mo) | Business (~KES 3,500/mo) |
|---|---|---|---|
| Invoices / month | 10 | Unlimited | Unlimited |
| Staff seats | 1 | 3 | 10 |
| Payment gateways (STK, webhooks) | — | ✓ | ✓ |
| SMS bundle / month | — | 100 | 500 |
| Payouts (B2C) | — | — | ✓ |
| Customer portal (wall QR) | — | — | ✓ |

- Yearly billing at ~20% discount.
- Free tier is the marketing engine. Gateway automation is the natural upgrade trigger: the moment a business wants M-Pesa auto-matching, they pay.
- Anchor: Zoho Books Kenya ≈ KES 2,000/mo. Enter slightly below with a local-first feature set (eTIMS, M-Pesa, SMS).

## Trial and expiry

- **30 days of Business tier on signup**, no payment details upfront.
- Countdown banner during the final 7 days.
- On expiry: **read-only mode** — never data hostage. Viewing and exporting always work; creating/editing is blocked. Reactivation is instant via STK push.

## SMS credits

- Platform Advanta account is the default: `getOrgSmsConfig` falls back to env-level platform credentials when the org has no own config.
- Monthly bundle included per plan; top-ups purchasable (e.g. 500 SMS / KES 500) through the same STK checkout.
- `sms_log` already records per-org usage; add a balance check before each send.
- Per-org Advanta credentials remain as a bring-your-own override (business gets its own sender ID; reduces our SMS cost). Free feature — it pays for itself.

## Architecture (deliberately boring)

- `subscriptions` table: `org_id, plan, status, paid_until`, written by the same pending/confirm webhook pattern used for receipts.
- Plans defined **in code** (a single `PLANS` const), not in the database. Pricing will iterate; config beats an admin UI at this stage.
- One `entitlements(orgId)` helper returning the org's limits, enforced inside the existing `requirePerm` / server-action guards.
- Gating at ~5 chokepoints only: create invoice, invite staff, enable gateway, send SMS, initiate payout. No feature flags sprinkled through the codebase.
- Renewal nudges at T-7, T-1, T+0 via a daily cron, using the existing SMS + email channels.

## Onboarding funnel

- Signup flow already exists.
- Add a 3-step first-run checklist card on the dashboard: business profile → add a customer → send first invoice, with progress indication.
- The paywall never blocks the funnel — the trial covers onboarding. The wall appears only at expiry or on gated features.
- North-star activation event: **first invoice sent**. Optimize onboarding for that, not for showing pricing early.

## Build order

| Step | Scope | Effort |
|---|---|---|
| 1 | Entitlements helper + plan fields on org + read-only mode | ~half session |
| 2 | Billing checkout: pricing page, STK push, webhook confirm, `paid_until` extension | ~1 session |
| 3 | Platform SMS fallback + credit balance + top-up purchase | ~half session |
| 4 | Trial countdown, renewal-nudge cron, onboarding checklist | ~1 session |

Total ≈ 3 sessions to "can charge money."

## Open decisions

1. Final price points (owner decision, customer-validated).
2. Yearly discount percentage.
3. Whether Free tier includes the customer portal (recommend: no — it drives Business upgrades).
4. Grace period length after expiry before read-only (recommend: 5 days).
