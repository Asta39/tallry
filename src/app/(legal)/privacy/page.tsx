export const metadata = { title: "Privacy Policy — Tallry" };

const LAST_UPDATED = "12 July 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-gray-500">Last updated: {LAST_UPDATED}</p>

      <p>
        Tallry (&quot;we&quot;, &quot;us&quot;, &quot;the Service&quot;) is an accounting and payments
        platform for Kenyan businesses. This policy explains what personal data we collect, why,
        and the rights you have under the <strong>Data Protection Act, 2019 (Kenya)</strong> and
        its regulations. It applies to business owners and staff who use Tallry, and to their
        customers whose details are processed through the Service.
      </p>

      <h2>1. Who is responsible for your data</h2>
      <p>
        For account data of businesses using Tallry, we act as <strong>data controller</strong>.
        For the customer and supplier records a business keeps inside Tallry (names, phone
        numbers, invoices, payments), that business is the data controller and we act as its{" "}
        <strong>data processor</strong>. Contact for all data matters:{" "}
        <a href="mailto:privacy@tallry.com">privacy@tallry.com</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Account data</strong> — name, email, phone, business details, KRA PIN, login credentials.</li>
        <li><strong>Business records</strong> — contacts, invoices, bills, payroll, ledger entries entered by the business.</li>
        <li><strong>Payment data</strong> — M-Pesa and Kopo Kopo transaction details received via payment gateways: payer phone number, name, amount, receipt numbers. We never see or store M-Pesa PINs.</li>
        <li><strong>Receipt access data</strong> — when a customer uses a receipt link or the customer portal: the phone number they verify, one-time codes (stored hashed), and access sessions.</li>
        <li><strong>Technical data</strong> — device/browser information and logs needed to keep the Service secure.</li>
      </ul>

      <h2>3. Why we process it (lawful basis)</h2>
      <ul>
        <li>To provide the Service — bookkeeping, invoicing, payments, receipts (performance of contract).</li>
        <li>To meet legal duties — tax record-keeping under Kenyan law, including KRA requirements (legal obligation).</li>
        <li>To send transactional messages — payment receipts and verification codes by SMS or email (legitimate interest / contract).</li>
        <li>To secure the Service — fraud prevention, audit logs (legitimate interest).</li>
      </ul>
      <p>We do not sell personal data. We do not use it for third-party advertising.</p>

      <h2>4. Who we share it with</h2>
      <ul>
        <li><strong>Safaricom (M-Pesa Daraja)</strong> and <strong>Kopo Kopo</strong> — to process payments you initiate or receive.</li>
        <li><strong>Advanta</strong> — to deliver SMS receipts and verification codes.</li>
        <li><strong>Resend</strong> — to deliver email receipts and notifications.</li>
        <li><strong>Supabase</strong> — our database and authentication host.</li>
      </ul>
      <p>
        Some providers store data outside Kenya (including the EU and US). Where data leaves
        Kenya we rely on providers with appropriate safeguards, consistent with sections 48–49
        of the Data Protection Act.
      </p>

      <h2>5. How long we keep it</h2>
      <p>
        Financial records are kept for at least <strong>five (5) years</strong> as required by
        Kenyan tax law, even after an account closes. Portal verification codes expire after 10
        minutes; portal sessions after 30 days. Other personal data is deleted or anonymised when
        no longer needed.
      </p>

      <h2>6. How we protect it</h2>
      <ul>
        <li>Encryption in transit (HTTPS) and at rest; payment gateway credentials additionally encrypted with AES-256.</li>
        <li>Verification codes stored only as one-way hashes.</li>
        <li>Role-based access controls inside each business account.</li>
        <li>Receipt links use unguessable random tokens; the customer portal requires phone verification.</li>
      </ul>

      <h2>7. Your rights</h2>
      <p>Under the Data Protection Act, 2019 you may:</p>
      <ul>
        <li>ask what personal data we hold about you and get a copy (access);</li>
        <li>correct inaccurate data (rectification);</li>
        <li>ask for deletion where the law allows (erasure) — note tax records must be retained per section 5 above;</li>
        <li>object to or restrict certain processing;</li>
        <li>receive your data in a portable format.</li>
      </ul>
      <p>
        Write to <a href="mailto:privacy@tallry.com">privacy@tallry.com</a>. We respond within a
        reasonable time and at no cost, as the Act requires. If unsatisfied, you may complain to
        the <strong>Office of the Data Protection Commissioner (ODPC)</strong> —{" "}
        <a href="https://www.odpc.go.ke" target="_blank" rel="noopener noreferrer">www.odpc.go.ke</a>.
      </p>

      <h2>8. Customers of businesses using Tallry</h2>
      <p>
        If a business you paid uses Tallry, your phone number and payment details were provided
        to us by that business or by the payment network to issue your receipt. Direct your
        requests to that business first; we assist them in fulfilling your rights.
      </p>

      <h2>9. Changes</h2>
      <p>
        We will post any changes here and update the date above. Material changes will be
        notified inside the Service.
      </p>
    </>
  );
}
