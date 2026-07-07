import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { db, org } from "@/db";
import { eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { OrgProfileForm } from "@/components/OrgProfileForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const user = await getUser();
  if (!user) redirect("/login");

  
  if (!o) redirect("/onboarding");

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="One page. That's the whole point."
      />

      <OrgProfileForm
        initial={{
          name: o.name,
          kraPin: o.kraPin,
          vatRegistered: o.vatRegistered,
          address: o.address,
          phone: o.phone,
          email: o.email,
          invoicePrefix: o.invoicePrefix,
          invoiceTemplate: o.invoiceTemplate,
          quoteTemplate: o.quoteTemplate,
          logoUrl: o.logoUrl,
          brandColor: o.brandColor,
          customDocumentColumnName: o.customDocumentColumnName,
          documentFooterText: o.documentFooterText,
          dataSegregation: o.dataSegregation,
          userId: o.userId,
        }}
      />

      <div className="card px-6 py-5 max-w-2xl mt-5 text-[12.5px] text-[var(--color-ink-600)] space-y-1.5">
        <div className="font-semibold text-[var(--color-ink-900)]">Kenya compliance defaults (already set up for you)</div>
        <p>· VAT rates: 16% standard, 0% zero-rated, exempt — per line item, eTIMS classes A–D.</p>
        <p>· eTIMS: invoices are signed by a <b>simulated</b> control unit (CU number + KRA QR). Connect a real OSCU/VSCU before using invoices fiscally.</p>
        <p>· Withholding: record customer WHT deductions when receiving payment — tracked as a KRA receivable.</p>
        <p>· VAT return prep and trial balance live under Reports; file on iTax by the 20th.</p>
      </div>
    </>
  );
}
