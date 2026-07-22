export const metadata = { title: "Terms of Service — Zeno" };

const LAST_UPDATED = "12 July 2026";

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="text-gray-500">Last updated: {LAST_UPDATED}</p>

      <p>
        These terms govern use of Zeno, an accounting and payments platform for Kenyan
        businesses. By creating an account or using the Service you agree to them.
      </p>

      <h2>1. The Service</h2>
      <p>
        Zeno provides bookkeeping, invoicing, payroll, payment-gateway integration (M-Pesa,
        Kopo Kopo), and receipt delivery tools. We are a software provider — we are{" "}
        <strong>not</strong> a bank, a money remitter, or a tax agent.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must provide accurate business information and keep credentials confidential.</li>
        <li>You are responsible for actions taken by staff you invite and the permissions you grant them.</li>
        <li>One business per organisation account; you may not use the Service for unlawful activity.</li>
      </ul>

      <h2>3. Payments and payouts</h2>
      <ul>
        <li>Payment collection and disbursement run through your own Safaricom Daraja and/or Kopo Kopo accounts, under those providers&apos; terms. Fees charged by those providers are yours.</li>
        <li>You are responsible for the accuracy of payout destinations and amounts you initiate. Payouts move real money and may be irreversible.</li>
        <li>We record transactions as reported by the gateway; discrepancies must be raised with the gateway provider.</li>
      </ul>

      <h2>4. Tax and compliance</h2>
      <ul>
        <li>You remain solely responsible for your tax filings and obligations to the Kenya Revenue Authority.</li>
        <li>Until connected to a live KRA eTIMS control unit, invoice fiscal signatures in the Service are <strong>simulated</strong> and not valid for fiscal purposes.</li>
        <li>Reports (VAT, payroll deductions, etc.) are prepared from the data you enter; verify before filing.</li>
      </ul>

      <h2>5. Customer data</h2>
      <p>
        You confirm you have a lawful basis to enter your customers&apos; and suppliers&apos;
        details into the Service, and you appoint us as your data processor for that data as
        described in the <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>6. Messaging</h2>
      <p>
        SMS and email receipts are sent on your behalf and at your instruction. You are
        responsible for ensuring recipients expect these messages. SMS costs are billed per your
        plan or your own provider account.
      </p>

      <h2>7. Availability and data</h2>
      <ul>
        <li>We aim for high availability but the Service is provided &quot;as is&quot; without uptime warranty.</li>
        <li>We back up data regularly. You can export your records at any time.</li>
        <li>On account closure we retain financial records for the statutory five-year period, then delete them.</li>
      </ul>

      <h2>8. Liability</h2>
      <p>
        To the maximum extent permitted by Kenyan law, our liability for any claim arising from
        the Service is limited to the fees you paid us in the twelve (12) months before the
        claim. We are not liable for indirect losses, or for losses caused by payment providers,
        telecom operators, or incorrect data you entered.
      </p>

      <h2>9. Suspension and termination</h2>
      <p>
        We may suspend accounts used for fraud, unlawful activity, or abuse of the platform. You
        may close your account at any time; section 7 retention still applies.
      </p>

      <h2>10. Changes and governing law</h2>
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
