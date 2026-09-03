"use server";

import { db, campaigns, campaignRecipients, contacts, contactGroupMemberships, customerGroups } from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { nowISO } from "@/lib/money";
import { getOrgSmsConfig, sendSms } from "@/lib/sms";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function listCampaigns() {
  return withOrg(async () => {
    await requirePerm("campaigns");
    const orgId = currentOrgId();
    return db.select().from(campaigns).where(eq(campaigns.orgId, orgId)).orderBy(desc(campaigns.id));
  });
}

export async function listCampaignGroups() {
  return withOrg(async () => {
    await requirePerm("campaigns");
    const orgId = currentOrgId();
    return db.select({ id: customerGroups.id, name: customerGroups.name }).from(customerGroups).where(eq(customerGroups.orgId, orgId)).orderBy(customerGroups.name);
  });
}

export async function createCampaignAction(name: string, groupId: number, message: string) {
  return withOrg(async () => {
    await requirePerm("campaigns");
    const access = await getAccess();
    const orgId = currentOrgId();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName) throw new Error("Give the campaign a name");
    if (!trimmedMessage) throw new Error("Write the message to send");
    const [group] = await db.select({ id: customerGroups.id }).from(customerGroups).where(and(eq(customerGroups.orgId, orgId), eq(customerGroups.id, groupId))).limit(1);
    if (!group) throw new Error("Pick a real customer group");
    const [created] = await db
      .insert(campaigns)
      .values({
        orgId,
        name: trimmedName,
        groupId,
        message: trimmedMessage,
        status: "draft",
        createdByMemberId: access?.memberId ?? null,
        createdAt: nowISO(),
      })
      .returning();
    await logAudit({ action: "create", module: "campaigns", recordId: created.id, recordLabel: trimmedName });
    revalidatePath("/campaigns");
    return created.id;
  });
}

/** Sends a draft campaign now: loops the group's contacts with a phone
 *  number, calls sendSms() per recipient (same primitive the payment-receipt
 *  path already uses), and records a per-contact result so a failure is
 *  diagnosable instead of only visible as a lower success count. */
export async function sendCampaignAction(campaignId: number) {
  return withOrg(async () => {
    await requirePerm("campaigns");
    const orgId = currentOrgId();
    const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.orgId, orgId), eq(campaigns.id, campaignId))).limit(1);
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sending" || campaign.status === "sent") throw new Error("This campaign has already been sent");

    const cfg = await getOrgSmsConfig(orgId);
    if (!cfg) throw new Error("Configure your SMS provider under Settings → SMS first");

    const recipients = await db
      .select({ id: contacts.id, phone: contacts.phone })
      .from(contactGroupMemberships)
      .innerJoin(contacts, eq(contactGroupMemberships.contactId, contacts.id))
      .where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.groupId, campaign.groupId), eq(contacts.archived, false)));
    const withPhone = recipients.filter((r): r is { id: number; phone: string } => !!r.phone);
    if (withPhone.length === 0) throw new Error("Nobody in this group has a phone number on file");

    await db.update(campaigns).set({ status: "sending", recipientCount: withPhone.length }).where(eq(campaigns.id, campaignId));

    let successCount = 0;
    let failureCount = 0;
    for (const r of withPhone) {
      const result = await sendSms(cfg, r.phone, campaign.message);
      if (result.ok) successCount++;
      else failureCount++;
      await db.insert(campaignRecipients).values({
        campaignId,
        contactId: r.id,
        phone: r.phone,
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? nowISO() : null,
        error: result.error ?? null,
      });
    }

    await db
      .update(campaigns)
      .set({
        status: failureCount === withPhone.length ? "failed" : "sent",
        sentAt: nowISO(),
        successCount,
        failureCount,
      })
      .where(eq(campaigns.id, campaignId));

    await logAudit({ action: "update", module: "campaigns", recordId: campaignId, recordLabel: campaign.name, detail: `Sent to ${successCount}/${withPhone.length}` });
    revalidatePath("/campaigns");
    return { successCount, failureCount, total: withPhone.length };
  });
}

export async function getCampaignRecipients(campaignId: number) {
  return withOrg(async () => {
    await requirePerm("campaigns");
    const orgId = currentOrgId();
    const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.orgId, orgId), eq(campaigns.id, campaignId))).limit(1);
    if (!campaign) throw new Error("Campaign not found");
    return db
      .select({ contactId: campaignRecipients.contactId, phone: campaignRecipients.phone, status: campaignRecipients.status, error: campaignRecipients.error, name: contacts.displayName })
      .from(campaignRecipients)
      .innerJoin(contacts, eq(campaignRecipients.contactId, contacts.id))
      .where(eq(campaignRecipients.campaignId, campaignId));
  });
}
