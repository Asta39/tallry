"use server";

import { db, paymentRuns, paymentRunItems, documents, contacts, bankAccounts } from "@/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { withOrg, currentOrgId } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { recordPayment } from "@/lib/actions";
import { nowISO, todayISO } from "@/lib/money";
import { revalidatePath } from "next/cache";

/** Open/partial bills available to pull into a new payment run. */
export async function listPayableBills() {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const rows = await db
      .select({
        id: documents.id,
        number: documents.number,
        date: documents.date,
        dueDate: documents.dueDate,
        totalCents: documents.totalCents,
        paidCents: documents.paidCents,
        contactId: documents.contactId,
        vendorName: contacts.displayName,
      })
      .from(documents)
      .leftJoin(contacts, eq(documents.contactId, contacts.id))
      .where(and(eq(documents.orgId, orgId), eq(documents.type, "bill"), inArray(documents.status, ["open", "partial"])))
      .orderBy(documents.dueDate);
    return rows.map((r) => ({ ...r, balanceCents: r.totalCents - r.paidCents }));
  });
}

export async function listPaymentRuns() {
  return withOrg(() =>
    db.select().from(paymentRuns).where(eq(paymentRuns.orgId, currentOrgId())).orderBy(desc(paymentRuns.id))
  );
}

export async function getPaymentRun(id: number) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const [run] = await db.select().from(paymentRuns).where(and(eq(paymentRuns.orgId, orgId), eq(paymentRuns.id, id))).limit(1);
    if (!run) return null;
    const items = await db
      .select({
        id: paymentRunItems.id,
        billId: paymentRunItems.billId,
        amountCents: paymentRunItems.amountCents,
        status: paymentRunItems.status,
        failReason: paymentRunItems.failReason,
        billNumber: documents.number,
        vendorName: contacts.displayName,
      })
      .from(paymentRunItems)
      .innerJoin(documents, eq(paymentRunItems.billId, documents.id))
      .leftJoin(contacts, eq(documents.contactId, contacts.id))
      .where(and(eq(paymentRunItems.orgId, orgId), eq(paymentRunItems.runId, id)));
    const [bank] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, run.bankAccountId)).limit(1);
    return { run, items, bankName: bank?.name || "" };
  });
}

/** Create a draft run from selected bills. Doesn't touch the ledger yet. */
export async function createPaymentRunAction(data: {
  date: string;
  bankAccountId: number;
  method: string;
  items: { billId: number; amountCents: number }[];
}) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    if (data.items.length === 0) throw new Error("Select at least one bill");
    const [bank] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.id, data.bankAccountId))).limit(1);
    if (!bank) throw new Error("Bank account not found");

    // Validate each bill is still payable and the amount doesn't exceed its balance
    for (const item of data.items) {
      if (item.amountCents <= 0) throw new Error("Each amount must be greater than zero");
      const [bill] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, item.billId), eq(documents.type, "bill"))).limit(1);
      if (!bill) throw new Error(`Bill ${item.billId} not found`);
      if (!["open", "partial"].includes(bill.status)) throw new Error(`Bill ${bill.number} is no longer payable`);
      if (item.amountCents > bill.totalCents - bill.paidCents) throw new Error(`Amount for bill ${bill.number} exceeds its balance due`);
    }

    const totalCents = data.items.reduce((s, i) => s + i.amountCents, 0);
    const [run] = await db.insert(paymentRuns).values({
      orgId,
      date: data.date || todayISO(),
      bankAccountId: data.bankAccountId,
      method: data.method || "bank",
      totalCents,
      createdAt: nowISO(),
    }).returning();

    await db.insert(paymentRunItems).values(
      data.items.map((i) => ({ orgId, runId: run.id, billId: i.billId, amountCents: i.amountCents }))
    );

    revalidatePath("/purchases/payment-runs");
    return { id: run.id };
  });
}

/**
 * Post a draft run: pays each bill via the existing recordPayment/postPayment
 * pipeline (so WHT, bank mirroring, and document status updates all behave
 * exactly like a single manual payment). Best-effort — one bill failing
 * (e.g. voided after the run was drafted) doesn't block the rest; failures
 * are recorded on the item and surfaced back to the caller.
 */
export async function postPaymentRunAction(runId: number) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();

    const [run] = await db.select().from(paymentRuns).where(and(eq(paymentRuns.orgId, orgId), eq(paymentRuns.id, runId))).limit(1);
    if (!run) throw new Error("Payment run not found");
    if (run.status !== "draft") throw new Error("This run has already been posted");

    const items = await db.select().from(paymentRunItems).where(and(eq(paymentRunItems.orgId, orgId), eq(paymentRunItems.runId, runId)));

    let succeeded = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const [bill] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, item.billId))).limit(1);
        if (!bill) throw new Error("Bill no longer exists");
        if (!["open", "partial"].includes(bill.status)) throw new Error(`Bill is ${bill.status}, not payable`);
        const remaining = bill.totalCents - bill.paidCents;
        const amount = Math.min(item.amountCents, remaining);
        if (amount <= 0) throw new Error("Bill has no balance remaining");

        const paymentId = await recordPayment({
          direction: "out",
          documentId: item.billId,
          date: run.date,
          amountCents: amount,
          method: run.method,
          bankAccountId: run.bankAccountId,
          reference: `Payment run #${run.id}`,
        });

        await db.update(paymentRunItems).set({ status: "paid", paymentId }).where(eq(paymentRunItems.id, item.id));
        succeeded++;
      } catch (e: any) {
        await db.update(paymentRunItems).set({ status: "failed", failReason: e.message || "Payment failed" }).where(eq(paymentRunItems.id, item.id));
        failed++;
      }
    }

    await db.update(paymentRuns).set({ status: "posted", postedAt: nowISO() }).where(eq(paymentRuns.id, runId));
    revalidatePath("/purchases/payment-runs");
    revalidatePath(`/purchases/payment-runs/${runId}`);
    return { succeeded, failed };
  });
}

export async function deletePaymentRunAction(runId: number) {
  return withOrg(async () => {
    await requirePerm("accountant");
    const orgId = currentOrgId();
    const [run] = await db.select().from(paymentRuns).where(and(eq(paymentRuns.orgId, orgId), eq(paymentRuns.id, runId))).limit(1);
    if (!run) throw new Error("Payment run not found");
    if (run.status !== "draft") throw new Error("Only draft runs can be deleted");
    await db.delete(paymentRunItems).where(eq(paymentRunItems.runId, runId));
    await db.delete(paymentRuns).where(eq(paymentRuns.id, runId));
    revalidatePath("/purchases/payment-runs");
    return { success: true };
  });
}
