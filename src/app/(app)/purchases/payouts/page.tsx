import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, paymentEvents, documents, expenseClaims } from "@/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { PayoutsClient } from "./PayoutsClient";

export const dynamic = "force-dynamic";

export default async function StuckPayoutsPage() {
  await requirePerm("can_payout");
  const o = await getOrg();

  const events = await db
    .select()
    .from(paymentEvents)
    .where(and(eq(paymentEvents.orgId, o.id), eq(paymentEvents.direction, "out"), eq(paymentEvents.status, "pending")))
    .orderBy(desc(paymentEvents.id));

  const docIds = events.map((e) => e.matchedDocumentId).filter((id): id is number => id != null);
  const claimIds = events.map((e) => e.matchedExpenseClaimId).filter((id): id is number => id != null);

  const [docRows, claimRows] = await Promise.all([
    docIds.length > 0
      ? db.select({ id: documents.id, number: documents.number, type: documents.type }).from(documents).where(and(eq(documents.orgId, o.id), inArray(documents.id, docIds)))
      : Promise.resolve([]),
    claimIds.length > 0
      ? db.select({ id: expenseClaims.id, submittedByName: expenseClaims.submittedByName, description: expenseClaims.description }).from(expenseClaims).where(and(eq(expenseClaims.orgId, o.id), inArray(expenseClaims.id, claimIds)))
      : Promise.resolve([]),
  ]);
  const docById = new Map(docRows.map((d) => [d.id, d]));
  const claimById = new Map(claimRows.map((c) => [c.id, c]));

  const rows = events.map((e) => {
    const doc = e.matchedDocumentId ? docById.get(e.matchedDocumentId) : undefined;
    const claim = e.matchedExpenseClaimId ? claimById.get(e.matchedExpenseClaimId) : undefined;
    return {
      id: e.id,
      gatewayId: e.gatewayId,
      providerRef: e.providerRef,
      amountCents: e.amountCents,
      payerPhone: e.payerPhone,
      createdAt: e.createdAt,
      label: doc ? `${doc.type === "bill" ? "Bill" : "Expense"} ${doc.number}` : claim ? `Reimbursement · ${claim.submittedByName}` : "Unlinked",
      detail: claim?.description ?? undefined,
    };
  });

  return (
    <>
      <PageHeader
        title="Stuck Payouts"
        subtitle="Gateway payouts that haven't received a confirmation callback. Check the gateway's own dashboard before confirming — this records exactly what was originally requested."
      />
      <PayoutsClient rows={rows} />
    </>
  );
}
