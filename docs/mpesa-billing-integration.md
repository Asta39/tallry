# Implement M-Pesa STK Push for SaaS Billing

This plan outlines the steps to replace the simulated 5-second wait with a genuine M-Pesa STK Push integration using Safaricom Daraja Sandbox credentials. 

## Proposed Changes

We will introduce a dedicated backend webhook for SaaS billing, isolated from your customers' own payment gateways.

---

### Database Schema

#### [MODIFY] [schema.ts](file:///Users/ianlove/workspaces/zoho-books-clone/src/db/schema.ts)
- Add a new table `billing_transactions` to track STK Push requests. 
- Fields: `id`, `orgId`, `checkoutRequestId`, `plan`, `cycle`, `amount`, `status` (pending/success/failed), and timestamps.

### Backend Actions

#### [MODIFY] [actions.ts](file:///Users/ianlove/workspaces/zoho-books-clone/src/app/(app)/settings/billing/actions.ts)
- Implement `initiateMpesaBillingAction`: Authenticates with Daraja using Sandbox credentials, initiates the STK push (`CustomerPayBillOnline`), and creates a `pending` record in `billing_transactions` with the returned `CheckoutRequestID`.
- Implement `checkBillingStatusAction`: A simple polling action for the frontend to check if the status of a given `CheckoutRequestID` has changed from `pending` to `success` or `failed`.

### Webhook Route

#### [NEW] [route.ts](file:///Users/ianlove/workspaces/zoho-books-clone/src/app/api/webhooks/billing/mpesa/route.ts)
- Create a public webhook endpoint to receive Safaricom callbacks.
- On receipt, look up the `CheckoutRequestID` in `billing_transactions`.
- If successful (`ResultCode === 0`), update the transaction to `success` and update the organization's `subscriptions` record to grant the purchased plan and extend `paidUntil`.

### Frontend Updates

#### [MODIFY] [ClientPage.tsx](file:///Users/ianlove/workspaces/zoho-books-clone/src/app/(app)/settings/billing/ClientPage.tsx)
- Call `initiateMpesaBillingAction` instead of the simulated action.
- Show the loading state (Lottie animation).
- Start a polling interval (every 2.5 seconds) using `checkBillingStatusAction` to dynamically transition to the success screen the moment the webhook arrives.

---

## User Review Required

> [!IMPORTANT]
> **Environment Variables:** For the sandbox integration, I will hardcode the standard Daraja Sandbox credentials into the logic (or use `.env.local`). 
> **Webhook URLs:** Daraja STK Push callbacks require a publicly accessible HTTPS URL. Does your local development environment use **ngrok** (or a similar tunneling tool) so that Safaricom can reach your local server? If not, we will need to run one or use a proxy service so the webhook can be received!

## Verification Plan

### Automated Tests
- Build verification using `npm run build` after implementing the new tables and endpoints.
- Database migration verification (`npx drizzle-kit push`).

### Manual Verification
1. Click "Upgrade" on the Standard or Business plan.
2. Enter a test phone number.
3. Observe the loading animation and verify the STK push was logged.
4. Manually trigger the webhook locally using a tool like Postman or `curl` (or an ngrok tunnel) to simulate a successful payment.
5. Verify the UI automatically advances to the "Payment Successful" screen.
