import { db, journalEntries, journalLines } from "@/db";
import { and, eq } from "drizzle-orm";

/**
 * The balance-brought-forward row a statement should open with.
 *
 * `contacts.openingBalanceCents` is the *remaining* B/F balance: every payment
 * recorded against it (`_payContactOpeningBalance`) shrinks it, and once it
 * hits zero the date is nulled too. Statements that plot that field as the
 * "Balance brought forward" debit therefore lost the row entirely on a full
 * settlement while still subtracting the B/F payment — a negative running
 * balance — and double-counted the paid part on a partial settlement.
 *
 * The journal entry that originally posted the B/F balance is never touched
 * by those payments (they post their own entries), so it still carries the
 * full original amount and date. Reading it back keeps the statement's
 * running balance identical to the ledger.
 */
export async function getStatementOpeningBalance(
  orgId: number,
  contact: {
    id: number;
    kind: string;
    openingBalanceCents: number;
    openingBalanceDate: string | null;
    openingBalanceEntryId: number | null;
  }
): Promise<{ cents: number; date: string } | null> {
  if (contact.openingBalanceEntryId) {
    const [entry] = await db
      .select({ date: journalEntries.date })
      .from(journalEntries)
      .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.id, contact.openingBalanceEntryId)))
      .limit(1);
    if (entry) {
      const lines = await db
        .select({ debit: journalLines.debitCents, credit: journalLines.creditCents })
        .from(journalLines)
        .where(
          and(
            eq(journalLines.orgId, orgId),
            eq(journalLines.entryId, contact.openingBalanceEntryId),
            eq(journalLines.contactId, contact.id)
          )
        );
      // Same orientation as _setContactOpeningBalance: vendors' B/F sits on AP
      // (credit-normal), everyone else's on AR (debit-normal).
      const isPayable = contact.kind === "vendor";
      const cents = lines.reduce((s, l) => s + (isPayable ? l.credit - l.debit : l.debit - l.credit), 0);
      if (cents !== 0) return { cents, date: entry.date };
    }
  }
  // Legacy rows with no entry link: fall back to the tracked remaining balance.
  if (contact.openingBalanceCents && contact.openingBalanceDate) {
    return { cents: contact.openingBalanceCents, date: contact.openingBalanceDate };
  }
  return null;
}
