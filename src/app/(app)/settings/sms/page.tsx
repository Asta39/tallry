import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { db, smsSettings } from "@/db";
import { eq } from "drizzle-orm";
import { decryptConfig } from "@/lib/payments/crypto";
import { PageHeader } from "@/components/ui";
import { SmsSettingsForm } from "./SmsSettingsForm";

export const dynamic = "force-dynamic";

export default async function SmsSettingsPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const user = await getUser();
  if (!user || !o) redirect("/login");

  const [row] = await db.select().from(smsSettings).where(eq(smsSettings.orgId, o.id));
  const conf = row ? decryptConfig(row.configJson) : {};

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <PageHeader
        title="SMS Receipts"
        subtitle="Send customers a receipt link by SMS after every gateway payment"
      />
      <div className="mt-8">
        <SmsSettingsForm
          settings={{
            enabled: row?.enabled ?? false,
            hasSecrets: !!row?.configJson,
            senderId: conf?.senderId || "",
          }}
        />
      </div>
    </div>
  );
}
