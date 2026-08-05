"use server";

import { db, payments, bankAccounts } from "@/db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { postEntry, mirrorBankTxn, acct } from "@/lib/posting";
import { SYS } from "@/lib/coa";
import { nowISO, todayISO } from "@/lib/money";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";

/** Gateway-settled money is recorded in `payments` with method 'mpesa' or
 *  'kopokopo' (see webhook.ts). If a payment was recorded before the org
 *  had a bankAccounts row with kind='mpesa' — or that row was deleted and
 *  recreated — postPayment() had nothing to point at and fell back to the
 *  generic Undeposited Funds clearing account, so the till never actually
 *  moved even though the payment "showed" as received/paid in the UI. */
const GATEWAY_METHODS = ["mpesa", "kopokopo"];

async function findMpesaTill(orgId: number) {
  const [till] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.kind, "mpesa"), eq(bankAccounts.archived, false)))
    .limit(1);
  return till;
}

async function findMisrouted(orgId: number) {
  return db
    .select()
    .from(payments)
    .where(and(
      eq(payments.orgId, orgId),
      inArray(payments.method, GATEWAY_METHODS),
      isNull(payments.bankAccountId),
    ));
}

/** Read-only preview: how many payments are stuck in Undeposited Funds and
 *  for how much, split by direction. Shown before the admin runs the fix. */
export async function previewMpesaTillReconciliation() {
  return withOrg(async () => {
    await requirePerm("settings");
    const orgId = currentOrgId();
    const till = await findMpesaTill(orgId);
    const misrouted = await findMisrouted(orgId);
    const inCents = misrouted.filter((p) => p.direction === "in").reduce((s, p) => s + p.amountCents, 0);
    const outCents = misrouted.filter((p) => p.direction === "out").reduce((s, p) => s + p.amountCents, 0);
    return {
      hasTill: !!till,
      tillName: till?.name ?? null,
      count: misrouted.length,
      inCents,
      outCents,
    };
  });
}

/**
 * Moves every gateway payment stuck in Undeposited Funds into the org's
 * actual M-Pesa till: DR/CR a reclassification entry per payment (never
 * mutates the original journal_lines — journal_entries is append-only),
 * mirrors the bank transaction so the till's register shows it, and points
 * payments.bankAccountId at the till so future screens display it correctly.
 */
export async function reconcileMpesaTillAction(): Promise<{ success?: true; count?: number; error?: string }> {
  try {
    return await withOrg(async () => {
      await requirePerm("settings");
      const orgId = currentOrgId();

      const till = await findMpesaTill(orgId);
      if (!till) throw new Error("Set up an M-Pesa till bank account (Banking > Add Account, kind M-Pesa) before reconciling.");

      const misrouted = await findMisrouted(orgId);
      if (misrouted.length === 0) return { success: true, count: 0 };

      const undepositedAccountId = await acct(SYS.UNDEPOSITED);
      const date = todayISO();

      for (const p of misrouted) {
        const entryId = await postEntry({
          date,
          memo: `M-Pesa till reconciliation: move ${p.number} out of Undeposited Funds`,
          sourceType: "mpesa_till_reconciliation",
          sourceId: p.id,
          lines: p.direction === "in"
            ? [
                { accountId: till.accountId, debitCents: p.amountCents },
                { accountId: undepositedAccountId, creditCents: p.amountCents },
              ]
            : [
                { accountId: undepositedAccountId, debitCents: p.amountCents },
                { accountId: till.accountId, creditCents: p.amountCents },
              ],
        });

        await mirrorBankTxn({
          bankAccountId: till.id,
          date,
          description: `Reconciled · ${p.reference || p.number}`,
          amountCents: p.direction === "in" ? p.amountCents : -p.amountCents,
          journalEntryId: entryId,
          externalRef: `mpesa_till_reconcile:${p.id}`,
        });

        await db.update(payments).set({ bankAccountId: till.id }).where(eq(payments.id, p.id));
      }

      await logAudit({
        action: "reconcile_mpesa_till",
        module: "banking",
        recordLabel: till.name,
        detail: `${misrouted.length} payment(s) moved from Undeposited Funds`,
      });

      revalidatePath("/settings/payments");
      revalidatePath("/banking");
      revalidatePath("/reports");
      return { success: true, count: misrouted.length };
    });
  } catch (err: any) {
    return { error: err?.message || "Failed to reconcile" };
  }
}
