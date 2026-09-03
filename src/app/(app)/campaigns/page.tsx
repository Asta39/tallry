import { requirePerm } from "@/lib/guard";
import { listCampaigns, listCampaignGroups } from "@/lib/campaigns";
import { PageHeader } from "@/components/ui";
import { CampaignsClient } from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requirePerm("campaigns");
  const [campaigns, groups] = await Promise.all([listCampaigns(), listCampaignGroups()]);

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Send a bulk SMS to everyone in a customer group."
      />
      <CampaignsClient
        groups={groups}
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          message: c.message,
          status: c.status,
          recipientCount: c.recipientCount,
          successCount: c.successCount,
          failureCount: c.failureCount,
          createdAt: c.createdAt,
        }))}
      />
    </>
  );
}
