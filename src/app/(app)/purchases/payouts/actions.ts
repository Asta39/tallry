"use server";

import { db, paymentEvents, documents, bankAccounts, expenseClaims } from "@/db";
import { and, eq } from "drizzle-orm";
import { requirePerm } from "@/lib/guard";
import { getOrg, withOrg, currentOrgId } from "@/lib/org";
import { recordPayment } from "@/lib/actions";
import { applyExpenseClaimGatewayPayout } from "@/lib/expense-claims";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

/**
 * Manually confirm a gateway payout that's been stuck "pending" with no
 * webhook response — for when the accountant has checked the gateway's own
 * dashboard/portal and confirmed the money actually moved. This posts the
 * exact same payment the automatic webhook path would have, using the
 * amount and destination captured at request time (nothing re-entered by
 * hand here), and is audit-logged as a manual override.
 */
export async function confirmStuckPayoutAction(eventId: number): Promise<{ success?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("can_payout");
      const o = await getOrg();

      const [event] = await db
        .update(paymentEvents)
        .set({ status: "applying" })
        .where(and(eq(paymentEvents.id, eventId), eq(paymentEvents.orgId, o.id), eq(paymentEvents.direction, "out"), eq(paymentEvents.status, "pending")))
        .returning();
      if (!event) throw new Error("This payout is no longer pending — it may already have been resolved");

      try {
        if (event.matchedExpenseClaimId) {
          const entryId = await applyExpenseClaimGatewayPayout(event.matchedExpenseClaimId, event.amountCents, event.gatewayId);
          await db.update(paymentEvents).set({ status: "applied", paymentId: entryId }).where(eq(paymentEvents.id, event.id));
          const [claim] = await db.select({ submittedByName: expenseClaims.submittedByName }).from(expenseClaims).where(eq(expenseClaims.id, event.matchedExpenseClaimId)).limit(1);
          await logAudit({ action: "manual_confirm_payout", module: "expense_claims", recordId: event.matchedExpenseClaimId, recordLabel: claim?.submittedByName, detail: `Manually confirmed via ${event.gatewayId}, ref ${event.providerRef}` });
        } else if (event.matchedDocumentId) {
          const [mpesaBank] = await db
            .select({ id: bankAccounts.id })
            .from(bankAccounts)
            .where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false)))
            .limit(1);

          const paymentId = await recordPayment({
            direction: "out",
            documentId: event.matchedDocumentId,
            date: new Date().toISOString().split("T")[0],
            amountCents: event.amountCents,
            method: event.gatewayId === "mpesa_daraja" ? "mpesa" : "kopokopo",
            reference: event.providerRef,
            bankAccountId: mpesaBank?.id,
          });

          await db.update(paymentEvents).set({ status: "applied", paymentId }).where(eq(paymentEvents.id, event.id));
          const [doc] = await db.select({ number: documents.number }).from(documents).where(eq(documents.id, event.matchedDocumentId)).limit(1);
          await logAudit({ action: "manual_confirm_payout", module: "payments", recordId: event.matchedDocumentId, recordLabel: doc?.number, detail: `Manually confirmed via ${event.gatewayId}, ref ${event.providerRef}` });
        } else {
          throw new Error("This payout isn't linked to a bill, expense, or expense claim — nothing to confirm");
        }
      } catch (e) {
        await db.update(paymentEvents).set({ status: "pending" }).where(and(eq(paymentEvents.id, event.id), eq(paymentEvents.status, "applying")));
        throw e;
      }

      revalidatePath("/purchases/payouts");
      revalidatePath("/expense-claims");
      revalidatePath("/banking");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to confirm payout" };
  }
}

/**
 * Mark a stuck payout as failed/never sent — the bill, expense, or claim
 * simply stays payable (nothing to revert; initiating a payout never
 * changed their status, only this pending event's).
 */
export async function markStuckPayoutFailedAction(eventId: number, note: string): Promise<{ success?: true; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("can_payout");
      const orgId = currentOrgId();

      const [existing] = await db.select().from(paymentEvents).where(and(eq(paymentEvents.id, eventId), eq(paymentEvents.orgId, orgId))).limit(1);
      if (!existing) throw new Error("Payout event not found");
      let raw: any = {};
      try { raw = existing.rawJson ? JSON.parse(existing.rawJson) : {}; } catch { raw = { original: existing.rawJson }; }
      raw._manualFail = { note: note.slice(0, 200), at: new Date().toISOString() };

      const [event] = await db
        .update(paymentEvents)
        .set({ status: "failed", rawJson: JSON.stringify(raw) })
        .where(and(eq(paymentEvents.id, eventId), eq(paymentEvents.orgId, orgId), eq(paymentEvents.direction, "out"), eq(paymentEvents.status, "pending")))
        .returning();
      if (!event) throw new Error("This payout is no longer pending — it may already have been resolved");

      await logAudit({ action: "manual_fail_payout", module: "payments", recordId: event.matchedDocumentId ?? event.matchedExpenseClaimId, detail: note || undefined });

      revalidatePath("/purchases/payouts");
      return { success: true };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to update payout" };
  }
}
