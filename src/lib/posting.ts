import {
  db,
  accounts,
  documents,
  documentLines,
  journalEntries,
  journalLines,
  bankAccounts,
  bankTransactions,
  items,
  payments as paymentsTable,
} from "@/db";
import { eq, and } from "drizzle-orm";
import { currentOrgId } from "@/lib/org";
import { SYS } from "./coa";
import { addLot, consumeFifo } from "./inventory";
import { nowISO } from "./money";

/**
 * The posting engine — the ONLY writer to journal_entries / journal_lines.
 * Every function throws if debits ≠ credits.
 */

export interface PostLine {
  accountId: number;
  debitCents?: number;
  creditCents?: number;
  contactId?: number | null;
  memo?: string;
  costCenterId?: number | null;
}

/** Cache keyed per-org: same account code maps to different ids per org. */
const codeCache = new Map<string, number>();
export async function acct(code: string): Promise<number> {
  const orgId = currentOrgId();
  const key = `${orgId}:${code}`;
  const hit = codeCache.get(key);
  if (hit) return hit;
  const [row] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code))).limit(1);
  if (!row) throw new Error(`System account ${code} missing — run db:seed`);
  codeCache.set(key, row.id);
  return row.id;
}

export async function postEntry(params: {
  date: string;
  memo?: string;
  sourceType: string;
  sourceId?: number;
  reversalOfId?: number;
  lines: PostLine[];
}): Promise<number> {
  const lines = params.lines.filter(
    (l) => (l.debitCents ?? 0) !== 0 || (l.creditCents ?? 0) !== 0
  );
  const dr = lines.reduce((s, l) => s + (l.debitCents ?? 0), 0);
  const cr = lines.reduce((s, l) => s + (l.creditCents ?? 0), 0);
  if (dr !== cr) {
    throw new Error(`Unbalanced entry (${params.sourceType}): dr ${dr} ≠ cr ${cr}`);
  }
  if (lines.length === 0) throw new Error("Empty journal entry");

  // Books lock: nothing may post into a closed period (see org.lockDate).
  const { org: orgTable } = await import("@/db");
  const [orgRow] = await db
    .select({ lockDate: orgTable.lockDate })
    .from(orgTable)
    .where(eq(orgTable.id, currentOrgId()))
    .limit(1);
  if (orgRow?.lockDate && params.date <= orgRow.lockDate) {
    throw new Error(
      `Books are locked through ${orgRow.lockDate} — this entry is dated ${params.date}. Unlock in Accountant → Books lock first.`
    );
  }

  const [entry] = await db
    .insert(journalEntries)
    .values({
      orgId: currentOrgId(),
      date: params.date,
      memo: params.memo,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      reversalOfId: params.reversalOfId,
      createdAt: nowISO(),
    })
    .returning();

  await db.insert(journalLines).values(
    lines.map((l) => ({
      orgId: currentOrgId(),
      entryId: entry.id,
      accountId: l.accountId,
      debitCents: l.debitCents ?? 0,
      creditCents: l.creditCents ?? 0,
      contactId: l.contactId ?? null,
      memo: l.memo,
      costCenterId: l.costCenterId ?? null,
    }))
  );
  return entry.id;
}

/** Post a reversal of an existing entry (used by void). */
export async function reverseEntry(entryId: number, date: string, memo: string): Promise<number> {
  const lines = await db.select().from(journalLines).where(and(eq(journalLines.orgId, currentOrgId()), eq(journalLines.entryId, entryId)));
  const [src] = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, currentOrgId()), eq(journalEntries.id, entryId))).limit(1);
  return postEntry({
    date,
    memo,
    sourceType: `${src?.sourceType ?? "unknown"}_reversal`,
    sourceId: src?.sourceId ?? undefined,
    reversalOfId: entryId,
    lines: lines.map((l) => ({
      accountId: l.accountId,
      debitCents: l.creditCents,
      creditCents: l.debitCents,
      contactId: l.contactId,
    })),
  });
}

async function getDocWithLines(docId: number) {
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId))).limit(1);
  if (!doc) throw new Error(`Document ${docId} not found`);
  const lines = await db
    .select()
    .from(documentLines)
    .where(and(eq(documentLines.orgId, currentOrgId()), eq(documentLines.documentId, docId)));
  return { doc, lines };
}

/** Invoice: DR AR gross · CR Sales net + VAT Output; FIFO COGS for tracked items. */
export async function postInvoice(docId: number): Promise<number> {
  const { doc, lines } = await getDocWithLines(docId);
  const post: PostLine[] = [
    {
      accountId: await acct(SYS.AR),
      debitCents: doc.totalCents,
      contactId: doc.contactId,
      memo: doc.number,
    },
  ];
  for (const l of lines) {
    post.push({
      accountId: l.accountId ?? (await acct(SYS.SALES)),
      creditCents: l.netCents,
      memo: l.description,
      costCenterId: l.costCenterId,
    });
    if (l.taxCents > 0) {
      post.push({ accountId: await acct(SYS.VAT_OUTPUT), creditCents: l.taxCents });
    }
    // FIFO cost of goods for inventory-tracked items
    if (l.itemId) {
      const [item] = await db.select().from(items).where(and(eq(items.orgId, currentOrgId()), eq(items.id, l.itemId))).limit(1);
      if (item?.trackInventory) {
        const cogs = await consumeFifo(l.itemId, l.qty, l.warehouseId ?? undefined);
        if (cogs > 0) {
          post.push({ accountId: await acct(SYS.COGS), debitCents: cogs, memo: l.description });
          post.push({ accountId: await acct(SYS.INVENTORY), creditCents: cogs });
          await db.update(documentLines).set({ cogsCents: cogs }).where(and(eq(documentLines.orgId, currentOrgId()), eq(documentLines.id, l.id)));
        }
      }
    }
  }
  const entryId = await postEntry({
    date: doc.date,
    memo: `Invoice ${doc.number}`,
    sourceType: "invoice",
    sourceId: doc.id,
    lines: post,
  });
  await db
    .update(documents)
    .set({ journalEntryId: entryId, status: "open" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, doc.id)));
  return entryId;
}

/** Credit note: DR Sales + VAT Output · CR AR. (No stock return in v1.) */
export async function postCreditNote(docId: number): Promise<number> {
  const { doc, lines } = await getDocWithLines(docId);
  const post: PostLine[] = [
    {
      accountId: await acct(SYS.AR),
      creditCents: doc.totalCents,
      contactId: doc.contactId,
      memo: doc.number,
    },
  ];
  for (const l of lines) {
    post.push({ accountId: l.accountId ?? (await acct(SYS.SALES)), debitCents: l.netCents, costCenterId: l.costCenterId });
    if (l.taxCents > 0) post.push({ accountId: await acct(SYS.VAT_OUTPUT), debitCents: l.taxCents });
  }
  const entryId = await postEntry({
    date: doc.date,
    memo: `Credit note ${doc.number}`,
    sourceType: "credit_note",
    sourceId: doc.id,
    lines: post,
  });
  await db
    .update(documents)
    .set({ journalEntryId: entryId, status: "open" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, doc.id)));
  return entryId;
}

/** Bill: DR expense/inventory net + VAT Input · CR AP. Creates FIFO lots. */
export async function postBill(docId: number): Promise<number> {
  const { doc, lines } = await getDocWithLines(docId);
  const post: PostLine[] = [];
  let vatInput = 0;
  for (const l of lines) {
    let debitAccount = l.accountId ?? (await acct("6900"));
    if (l.itemId) {
      const [item] = await db.select().from(items).where(and(eq(items.orgId, currentOrgId()), eq(items.id, l.itemId))).limit(1);
      if (item?.trackInventory) {
        debitAccount = await acct(SYS.INVENTORY);
        await addLot({
          itemId: l.itemId,
          date: doc.date,
          qty: l.qty,
          unitCostCents: l.qty > 0 ? Math.round(l.netCents / l.qty) : 0,
          sourceType: "bill",
          sourceId: doc.id,
          warehouseId: l.warehouseId ?? undefined,
        });
      }
    }
    post.push({ accountId: debitAccount, debitCents: l.netCents, memo: l.description, costCenterId: l.costCenterId });
    vatInput += l.taxCents;
  }
  if (vatInput > 0) post.push({ accountId: await acct(SYS.VAT_INPUT), debitCents: vatInput });
  post.push({
    accountId: await acct(SYS.AP),
    creditCents: doc.totalCents,
    contactId: doc.contactId,
    memo: doc.number,
  });
  const entryId = await postEntry({
    date: doc.date,
    memo: `Bill ${doc.number}`,
    sourceType: "bill",
    sourceId: doc.id,
    lines: post,
  });
  await db
    .update(documents)
    .set({ journalEntryId: entryId, status: "open" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, doc.id)));
  return entryId;
}

/** Direct expense: DR expense net + VAT Input · CR bank/cash. Immediately paid. */
export async function postExpense(docId: number): Promise<number> {
  const { doc, lines } = await getDocWithLines(docId);
  if (!doc.paidFromBankAccountId) throw new Error("Expense needs a paid-from account");
  const [bank] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, currentOrgId()), eq(bankAccounts.id, Number(doc.paidFromBankAccountId))))
    .limit(1);
  if (!bank) throw new Error("Bank account not found");

  const post: PostLine[] = [];
  let vatInput = 0;
  for (const l of lines) {
    post.push({
      accountId: l.accountId ?? (await acct("6900")),
      debitCents: l.netCents,
      memo: l.description,
      costCenterId: l.costCenterId,
    });
    vatInput += l.taxCents;
  }
  if (vatInput > 0) post.push({ accountId: await acct(SYS.VAT_INPUT), debitCents: vatInput });
  post.push({ accountId: bank.accountId, creditCents: doc.totalCents, memo: doc.number });

  const entryId = await postEntry({
    date: doc.date,
    memo: `Expense ${doc.number}`,
    sourceType: "expense",
    sourceId: doc.id,
    lines: post,
  });
  await db
    .update(documents)
    .set({ journalEntryId: entryId, status: "paid", paidCents: doc.totalCents })
    .where(eq(documents.id, doc.id));

  // Mirror into the bank register so reconciliation sees this outflow.
  await mirrorBankTxn({
    bankAccountId: bank.id,
    date: doc.date,
    description: `Expense ${doc.number}`,
    amountCents: -doc.totalCents,
    journalEntryId: entryId,
    externalRef: `exp:${doc.id}`,
  });
  return entryId;
}

/**
 * Mirror a ledger bank movement into the bank register (bank_transactions) so
 * reconciliation sees every line the real statement will show. Idempotent via
 * externalRef. Rows arrive already booked (status "categorized",
 * journalEntryId set) — they are tickable in a reconciliation but never appear
 * in the "needs categorizing" queue.
 */
export async function mirrorBankTxn(params: {
  bankAccountId: number;
  date: string;
  description: string;
  amountCents: number; // signed: + money in, − money out
  journalEntryId: number;
  externalRef: string;
}) {
  const orgId = currentOrgId();
  const [existing] = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.externalRef, params.externalRef)))
    .limit(1);
  if (existing) return;
  await db.insert(bankTransactions).values({
    orgId,
    bankAccountId: params.bankAccountId,
    date: params.date,
    description: params.description,
    amountCents: params.amountCents,
    status: "categorized",
    journalEntryId: params.journalEntryId,
    externalRef: params.externalRef,
    createdAt: nowISO(),
  });
}

/**
 * Customer payment: DR bank (net received) + WHT Receivable (withheld) · CR AR (gross).
 * Vendor payment: DR AP · CR bank.
 * Updates the document's paid amount and status.
 */
export async function postPayment(paymentId: number): Promise<number> {
  const [p] = await db.select().from(paymentsTable).where(and(eq(paymentsTable.orgId, currentOrgId()), eq(paymentsTable.id, paymentId))).limit(1);
  if (!p) throw new Error("Payment not found");
  const bank = p.bankAccountId
    ? (await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, currentOrgId()), eq(bankAccounts.id, p.bankAccountId))).limit(1))[0]
    : null;
  const bankCoaId = bank ? bank.accountId : await acct(SYS.UNDEPOSITED);

  let lines: PostLine[];
  if (p.direction === "in") {
    lines = [
      { accountId: bankCoaId, debitCents: p.amountCents - p.whtCents, memo: p.reference ?? p.number },
      ...(p.whtCents > 0
        ? [
            {
              accountId: await acct(SYS.WHT_RECEIVABLE),
              debitCents: p.whtCents,
              memo: "WHT withheld by customer",
            },
          ]
        : []),
      { accountId: await acct(SYS.AR), creditCents: p.amountCents, contactId: p.contactId },
    ];
  } else {
    lines = [
      { accountId: await acct(SYS.AP), debitCents: p.amountCents, contactId: p.contactId },
      { accountId: bankCoaId, creditCents: p.amountCents, memo: p.reference ?? p.number },
    ];
  }

  const entryId = await postEntry({
    date: p.date,
    memo: `Payment ${p.number}`,
    sourceType: p.direction === "in" ? "customer_payment" : "vendor_payment",
    sourceId: p.id,
    lines,
  });
  await db.update(paymentsTable).set({ journalEntryId: entryId }).where(and(eq(paymentsTable.orgId, currentOrgId()), eq(paymentsTable.id, p.id)));

  // Mirror into the bank register so reconciliation sees this movement.
  // Direction "in" hits the bank net of WHT (matches the ledger line above).
  if (bank) {
    await mirrorBankTxn({
      bankAccountId: bank.id,
      date: p.date,
      description:
        p.direction === "in"
          ? `Payment received ${p.number}${p.reference ? ` · ${p.reference}` : ""}`
          : `Payment out ${p.number}${p.reference ? ` · ${p.reference}` : ""}`,
      amountCents: p.direction === "in" ? p.amountCents - p.whtCents : -p.amountCents,
      journalEntryId: entryId,
      externalRef: `pmt:${p.id}`,
    });
  }

  if (p.documentId) {
    const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, p.documentId))).limit(1);
    if (doc) {
      const paid = doc.paidCents + p.amountCents;
      const status = paid >= doc.totalCents ? "paid" : "partial";
      await db.update(documents).set({ paidCents: paid, status }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, doc.id)));
    }
  }
  return entryId;
}

/** Void a posted document: post reversal, mark void. */
export async function voidDocument(docId: number, date: string): Promise<void> {
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId))).limit(1);
  if (!doc) throw new Error("Document not found");
  if (doc.journalEntryId) {
    await reverseEntry(doc.journalEntryId, date, `Void ${doc.number}`);
  }
  await db.update(documents).set({ status: "void" }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
}
