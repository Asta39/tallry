import { getOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { db, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { PaymentGatewayForm } from "./PaymentGatewayForm";

export const dynamic = "force-dynamic";

export default async function PaymentsSettingsPage() {
  await requirePerm("settings");
  const o = await getOrg();
  const user = await getUser();
  if (!user || !o) redirect("/login");

  let gateways: any[] = [];
  let dbError = null;

  try {
    gateways = await db.select().from(paymentGateways).where(eq(paymentGateways.orgId, o.id));
  } catch (err: any) {
    console.error("Failed to query paymentGateways:", err);
    dbError = err.message;
  }

  // The client component will handle the masked state
  const gatewaysState = gateways.map(g => ({
    ...g,
    configJson: g.configJson ? "********" : "" // Don't send real config back to client
  }));

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Payment Gateways"
        subtitle="Configure incoming and outgoing payment integrations"
      />

      <div className="mt-8 space-y-8">
        {dbError ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm">
            Failed to load payment gateways: {dbError}. If you just deployed, make sure the database migrations ran successfully.
          </div>
        ) : (
          <PaymentGatewayForm gateways={gatewaysState} />
        )}
      </div>
    </div>
  );
}
