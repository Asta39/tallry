/**
 * Auto-invoicing for platform clients through the operator's own org.
 *
 * The platform operator (PLATFORM_ORG_ID) already uses Zeno as their own
 * CRM to invoice at least one client for their monthly maintenance fee —
 * this generalizes that (previously entirely manual) pattern: every client
 * org with active billing gets a matching Contact + recurring maintenance
 * invoice inside the operator's own org, kept in sync with that client's
 * real subscriptions.monthlyFeeCents. Trial orgs are never touched.
 *
 * Deliberately uses raw db.insert/db.update with an explicit orgId, the
 * same style already used throughout admin/actions.ts, rather than routing
 * through orgContext.run()/saveContact()/saveRecurringTemplate() — those
 * are hardwired to currentOrgId() (a single acting org) and add validation
 * (e.g. saveContact's customer-group requirement) that doesn't apply to
 * this internal, cross-org system write.
 */
import { db, org, subscriptions, contacts, recurringTemplates } from "@/db";
import { eq } from "drizzle-orm";
import { advance, endOfMonthISO } from "./recurring";
import { nowISO, todayISO } from "./money";
import type { DocLineInput } from "./actions";

export function getPlatformOrgId(): number | null {
  const raw = process.env.PLATFORM_ORG_ID;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function maintenanceLine(monthlyFeeCents: number): DocLineInput {
  return {
    itemId: null,
    description: "Zeno Books maintenance fee",
    qty: 1,
    unitPriceCents: monthlyFeeCents,
    discountPct: 0,
    taxClass: "D_NONVAT",
  };
}

/**
 * Idempotent: no-ops if the client is already linked, if PLATFORM_ORG_ID
 * isn't configured, or if the client isn't itself PLATFORM_ORG_ID (an
 * operator can't invoice itself).
 */
export async function ensurePlatformContactAndTemplate(clientOrgId: number): Promise<void> {
  const platformOrgId = getPlatformOrgId();
  if (!platformOrgId || clientOrgId === platformOrgId) return;

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, clientOrgId)).limit(1);
  if (!sub || sub.linkedContactId || sub.linkedRecurringTemplateId) return;

  const [clientOrg] = await db.select().from(org).where(eq(org.id, clientOrgId)).limit(1);
  if (!clientOrg) return;

  const [contact] = await db
    .insert(contacts)
    .values({
      orgId: platformOrgId,
      kind: "customer",
      displayName: clientOrg.name || `Org #${clientOrgId}`,
      email: clientOrg.email,
      phone: clientOrg.phone,
      kraPin: clientOrg.kraPin,
      address: clientOrg.address,
      notes: `Auto-linked Zeno client (org #${clientOrgId})`,
      createdAt: nowISO(),
    })
    .returning({ id: contacts.id });

  const nextRunDate = endOfMonthISO(advance(todayISO(), "monthly"));
  const [template] = await db
    .insert(recurringTemplates)
    .values({
      orgId: platformOrgId,
      name: `${clientOrg.name || `Org #${clientOrgId}`} — Zeno Books maintenance fee`,
      docType: "invoice",
      contactId: contact.id,
      frequency: "monthly",
      nextRunDate,
      dueEndOfMonth: true,
      autoIssue: false,
      taxInclusive: false,
      linesJson: JSON.stringify([maintenanceLine(sub.monthlyFeeCents)]),
      active: true,
      createdAt: nowISO(),
    })
    .returning({ id: recurringTemplates.id });

  await db
    .update(subscriptions)
    .set({ linkedContactId: contact.id, linkedRecurringTemplateId: template.id })
    .where(eq(subscriptions.id, sub.id));
}

/** Overwrites the linked template's stored line to the client's current
 *  monthlyFeeCents — always overwrites, same "stay in lockstep with the
 *  live source, never preserve a stale value" rule as syncSeatFee(). */
export async function syncPlatformInvoiceAmount(clientOrgId: number): Promise<void> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, clientOrgId)).limit(1);
  if (!sub?.linkedRecurringTemplateId) return;

  await db
    .update(recurringTemplates)
    .set({ linesJson: JSON.stringify([maintenanceLine(sub.monthlyFeeCents)]) })
    .where(eq(recurringTemplates.id, sub.linkedRecurringTemplateId));
}

/** Pauses/resumes the linked recurring template — a suspended or never-
 *  activated client shouldn't keep accumulating draft maintenance invoices. */
export async function setPlatformTemplateActive(clientOrgId: number, active: boolean): Promise<void> {
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, clientOrgId)).limit(1);
  if (!sub?.linkedRecurringTemplateId) return;

  await db.update(recurringTemplates).set({ active }).where(eq(recurringTemplates.id, sub.linkedRecurringTemplateId));
}
