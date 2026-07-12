import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { qrPngDataUrl } from "@/lib/receipts/qr";
import { EnableCard, WallQrCard } from "./PortalCards";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const user = await getUser();
  if (!user || !o) redirect("/login");

  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const portalUrl = o.portalSlug ? `${base}/p/${o.portalSlug}` : null;
  const qr = portalUrl ? await qrPngDataUrl(portalUrl) : null;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Customer Portal"
        subtitle="One QR code on your wall — customers scan, verify their phone, and download any of their receipts"
      />
      <div className="mt-8">
        {portalUrl && qr
          ? <WallQrCard orgName={o.name} portalUrl={portalUrl} qrDataUrl={qr} />
          : <EnableCard />}
      </div>
    </div>
  );
}
