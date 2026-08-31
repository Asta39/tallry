export const metadata = { title: "Terms of Service — Zeno" };

const LAST_UPDATED = "31 August 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-gray-500">Last updated: {LAST_UPDATED}</p>

      <p>
        These terms govern use of Zeno, an accounting, CRM and payroll platform for Kenyan
        businesses. By creating an account or using the Service you agree to them.
      </p>

      <h2>1. The Service</h2>
      <p>
        Zeno provides CRM (customers, deals, quotes, invoicing), accounting (bills, purchase
        orders, inventory, bank reconciliation, fixed assets, multi-location reporting) and
        payroll (statutory deductions, staff loans, salary advances) tools, along with
        payment-gateway integration (M-Pesa, Kopo Kopo), receipt delivery, a self-service
        customer portal, and an AI assistant (see section 8). Which of the CRM, Accounting and
        Payroll modules your organisation can see is based on what you've arranged with us — see
        section 3. We are a software provider — we are <strong>not</strong> a bank, a money
        remitter, or a tax agent.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must provide accurate business information and keep credentials confidential.</li>
        <li>You are responsible for actions taken by staff you invite and the permissions you grant them.</li>
        <li>One business per organisation account; you may not use the Service for unlawful activity.</li>
      </ul>

      <h2>3. Trial, fees and billing</h2>
      <ul>
        <li>New accounts get a free trial with full access to every module. If you don&apos;t activate before the trial ends, access is paused (a single contact screen replaces the app) until we reactivate your account.</li>
        <li>Reactivation requires a one-time setup fee, agreed with us directly, paid outside the Service.</li>
        <li>Once active, you pay a monthly maintenance fee based on the number of seats (yourself plus each staff member you add) on your account — shown on your Billing screen and recalculated automatically as your headcount changes. You may pay it in-app via M-Pesa/card, or have us record a payment made outside the Service.</li>
        <li>Which of CRM, Accounting and Payroll your staff can see reflects what's been paid for; toggling a module off only hides it from the interface — your data for it is preserved, not deleted, and can be switched back on.</li>
        <li>We may suspend an account for non-payment of the maintenance fee or at our discretion for the reasons in section 10; suspension pauses access the same way an expired trial does.</li>
      </ul>

      <h2>4. Payments and payouts</h2>
      <ul>
        <li>Payment collection and disbursement run through your own Safaricom Daraja and/or Kopo Kopo accounts, under those providers&apos; terms. Fees charged by those providers are yours.</li>
        <li>You are responsible for the accuracy of payout destinations and amounts you initiate. Payouts move real money and may be irreversible.</li>
        <li>We record transactions as reported by the gateway; discrepancies must be raised with the gateway provider.</li>
        <li>Your own maintenance-fee payments to us (section 3) are processed by our payment partner, IntaSend, under its own terms.</li>
      </ul>

      <h2>5. Tax and compliance</h2>
      <ul>
        <li>You remain solely responsible for your tax filings and obligations to the Kenya Revenue Authority.</li>
        <li>Until connected to a live KRA eTIMS control unit, invoice fiscal signatures in the Service are <strong>simulated</strong> and not valid for fiscal purposes.</li>
        <li>Reports (VAT, payroll deductions, etc.) are prepared from the data you enter; verify before filing.</li>
      </ul>

      <h2>6. Customer data</h2>
      <p>
        You confirm you have a lawful basis to enter your customers&apos; and suppliers&apos;
        details into the Service, and you appoint us as your data processor for that data as
        described in the <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>7. Messaging</h2>
      <p>
        SMS and email receipts, and the phone-verification codes used by the customer portal, are
        sent on your behalf and at your instruction. You are responsible for ensuring recipients
        expect these messages. SMS costs are billed per your plan or your own provider account.
      </p>

      <h2>8. AI assistant</h2>
      <p>
        The Service includes an optional AI assistant that can answer questions about your books
        and draft documents (invoices, quotes, bills, expenses) from a chat instruction. It can
        only see and act within the CRM/Accounting/Payroll modules enabled for your account
        (section 3). Any action that would create or change a record — a draft invoice, a
        recorded payment, and so on — is shown to you for explicit confirmation before it takes
        effect; the assistant never posts to your books unattended. AI-generated drafts and
        answers may be inaccurate or incomplete — you&apos;re responsible for reviewing them
        before relying on them, the same as anything else in your books. Business data included
        in a chat message is sent to our AI provider (see the <a href="/privacy">Privacy
        Policy</a>) solely to generate that response.
      </p>

      <h2>9. Availability and data</h2>
      <ul>
        <li>We aim for high availability but the Service is provided &quot;as is&quot; without uptime warranty.</li>
        <li>We back up data regularly. You can export your records at any time.</li>
        <li>On account closure we retain financial records for the statutory five-year period, then delete them.</li>
      </ul>

      <h2>10. Liability</h2>
      <p>
        To the maximum extent permitted by Kenyan law, our liability for any claim arising from
        the Service is limited to the fees you paid us in the twelve (12) months before the
        claim. We are not liable for indirect losses, or for losses caused by payment providers,
        telecom operators, our AI provider, or incorrect data you entered or an AI-generated draft
        you confirmed without reviewing.
      </p>

      <h2>11. Suspension and termination</h2>
      <p>
        We may suspend accounts used for fraud, unlawful activity, abuse of the platform, or
        non-payment of fees due (section 3). You may close your account at any time; section 9
        retention still applies.
      </p>

      <h2>12. Changes and governing law</h2>
      <p>
        We may update these terms; material changes will be notified in the Service. These terms
        are governed by the laws of Kenya, and disputes are subject to the jurisdiction of
        Kenyan courts after good-faith negotiation.
      </p>

      <p>
        Questions: <a href="mailto:support@zeno.com">support@zeno.com</a>
      </p>
    </>
  );
}
