"use server";

import { db, bankTransactions } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { withOrg, currentOrgId } from "./org";
import { nowISO } from "./money";
import { parseMpesaPdf, MpesaPasswordError, type MpesaTxn } from "./mpesa-pdf";

export interface ParsedMpesaResult {
  ok: boolean;
  error?: string;
  txns?: MpesaTxn[];
  duplicateReceipts?: string[]; // already imported before
}

/**
 * Parse an uploaded M-Pesa PDF (base64) with the ID-number password.
 * Returns transactions + flags which receipts were already imported, so the
 * UI can pre-tick only the new ones. Does NOT write anything yet.
 */
export async function parseMpesaStatement(
  base64: string,
  password: string
): Promise<ParsedMpesaResult> {
  try {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    const txns = await parseMpesaPdf(bytes, (password || "").trim());
    if (txns.length === 0) {
      return { ok: false, error: "No transactions found. Is this a Safaricom M-Pesa statement PDF?" };
    }

    return withOrg(async () => {
      const orgId = currentOrgId();
      const receipts = txns.map((t) => t.receipt);
      const existing = receipts.length
        ? await db
            .select({ ref: bankTransactions.externalRef })
            .from(bankTransactions)
            .where(and(eq(bankTransactions.orgId, orgId), inArray(bankTransactions.externalRef, receipts)))
        : [];
      const dupes = new Set(existing.map((e) => e.ref).filter(Boolean) as string[]);
      return { ok: true, txns, duplicateReceipts: [...dupes] };
    });
  } catch (e) {
    if (e instanceof MpesaPasswordError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Could not read the PDF." };
  }
}

/** Import selected M-Pesa transactions into a bank account, skipping dupes by receipt. */
export async function importMpesaTransactions(
  bankAccountId: number,
  txns: MpesaTxn[]
): Promise<{ created: number; skipped: number }> {
  return withOrg(async () => {
    const orgId = currentOrgId();
    if (txns.length === 0) return { created: 0, skipped: 0 };

    const receipts = txns.map((t) => t.receipt).filter(Boolean);
    const existing = receipts.length
      ? await db
          .select({ ref: bankTransactions.externalRef })
          .from(bankTransactions)
          .where(and(eq(bankTransactions.orgId, orgId), inArray(bankTransactions.externalRef, receipts)))
      : [];
    const seen = new Set(existing.map((e) => e.ref).filter(Boolean) as string[]);

    let created = 0, skipped = 0;
    const toInsert = [];
    for (const t of txns) {
      if (t.receipt && seen.has(t.receipt)) { skipped++; continue; }
      if (t.receipt) seen.add(t.receipt);
      toInsert.push({
        orgId,
        bankAccountId,
        date: t.date,
        description: t.receipt ? `${t.details} · ${t.receipt}` : t.details,
        amountCents: t.amountCents,
        externalRef: t.receipt || null,
        createdAt: nowISO(),
      });
      created++;
    }
    if (toInsert.length) await db.insert(bankTransactions).values(toInsert);
    revalidatePath("/banking");
    return { created, skipped };
  });
}
