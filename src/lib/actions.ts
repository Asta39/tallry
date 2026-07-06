"use server";

import {
  db,
  org,
  contacts,
  deals,
  items,
  documents,
  documentLines,
  payments,
  bankAccounts,
  bankTransactions,
  activities,
  accounts,
} from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { computeDocument, type TaxClass, TAX_CLASSES } from "./tax";
import {
  postInvoice,
  postCreditNote,
  postBill,
  postExpense,
  postPayment,
  postEntry,
  voidDocument,
  acct,
} from "./posting";
import { addLot, consumeFifo } from "./inventory";
import { SYS } from "./coa";
import { nowISO, todayISO } from "./money";
import { getTaxDevice } from "./etims";
import { getUser } from "./supabase/server";

/** revalidatePath, but safe when called outside a Next request (scripts, tests). */
function revalidatePath(path: string) {
  try {
    nextRevalidatePath(path);
  } catch {
    /* running outside Next request context */
  }
}

async function getOrg() {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated — please sign in.");
  const [row] = await db.select().from(org).where(eq(org.userId, user.id)).limit(1);
  if (!row) throw new Error("Organization not found — please complete onboarding.");
  return row;
}

type NumberKind = "invoice" | "quote" | "credit_note" | "purchase_order" | "payment";
async function nextNumber(kind: NumberKind): Promise<string> {
  const o = await getOrg();
  const prefixes: Record<NumberKind, string> = {
    invoice: o.invoicePrefix,
    quote: "QT-",
    credit_note: "CN-",
    purchase_order: "PO-",
    payment: "PMT-",
  };
  const current: Record<NumberKind, number> = {
    invoice: o.nextInvoiceNo,
    quote: o.nextQuoteNo,
    credit_note: o.nextCreditNoteNo,
    purchase_order: o.nextPoNo,
    payment: o.nextPaymentNo,
  };
  const n = current[kind];
  await db
    .update(org)
    .set({
      nextInvoiceNo: kind === "invoice" ? n + 1 : o.nextInvoiceNo,
      nextQuoteNo: kind === "quote" ? n + 1 : o.nextQuoteNo,
      nextCreditNoteNo: kind === "credit_note" ? n + 1 : o.nextCreditNoteNo,
      nextPoNo: kind === "purchase_order" ? n + 1 : o.nextPoNo,
      nextPaymentNo: kind === "payment" ? n + 1 : o.nextPaymentNo,
    })
    .where(eq(org.id, 1));
  return `${prefixes[kind]}${String(n).padStart(4, "0")}`;
}

/* ---------------- Contacts & CRM ---------------- */

export async function saveContact(data: {
  id?: number;
  kind: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  kraPin?: string;
  address?: string;
  city?: string;
  notes?: string;
  isWithholdingAgent?: boolean;
}) {
  if (data.id) {
    await db.update(contacts).set({ ...data, id: undefined }).where(eq(contacts.id, data.id));
  } else {
    await db.insert(contacts).values({ ...data, createdAt: nowISO() });
  }
  revalidatePath("/contacts");
}

export async function addActivity(contactId: number, kind: string, content: string) {
  await db
    .insert(activities)
    .values({ contactId, kind, content, date: todayISO(), createdAt: nowISO() });
  revalidatePath(`/contacts/${contactId}`);
}

export async function saveDeal(data: {
  id?: number;
  contactId: number;
  title: string;
  amountCents: number;
  stage: string;
  expectedClose?: string;
  notes?: string;
}) {
  if (data.id) {
    await db
      .update(deals)
      .set({ ...data, id: undefined, updatedAt: nowISO() })
      .where(eq(deals.id, data.id));
  } else {
    await db.insert(deals).values({ ...data, createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath("/pipeline");
}

export async function moveDealStage(dealId: number, stage: string) {
  await db.update(deals).set({ stage, updatedAt: nowISO() }).where(eq(deals.id, dealId));
  revalidatePath("/pipeline");
}

/* ---------------- Items ---------------- */

export async function saveItem(data: {
  id?: number;
  kind: string;
  name: string;
  sku?: string;
  unit: string;
  description?: string;
  salePriceCents: number;
  purchaseCostCents: number;
  taxClass: string;
  trackInventory: boolean;
  reorderLevel: number;
  openingQty?: number;
  openingUnitCostCents?: number;
}) {
  const [salesAcc] = await db.select().from(accounts).where(eq(accounts.code, SYS.SALES)).limit(1);
  if (data.id) {
    await db
      .update(items)
      .set({
        kind: data.kind,
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        description: data.description,
        salePriceCents: data.salePriceCents,
        purchaseCostCents: data.purchaseCostCents,
        taxClass: data.taxClass,
        trackInventory: data.trackInventory,
        reorderLevel: data.reorderLevel,
      })
      .where(eq(items.id, data.id));
  } else {
    const [created] = await db
      .insert(items)
      .values({
        kind: data.kind,
        name: data.name,
        sku: data.sku,
        unit: data.unit,
        description: data.description,
        salePriceCents: data.salePriceCents,
        purchaseCostCents: data.purchaseCostCents,
        taxClass: data.taxClass,
        trackInventory: data.trackInventory,
        reorderLevel: data.reorderLevel,
        salesAccountId: salesAcc?.id,
      })
      .returning();
    // Opening stock: FIFO lot + journal (DR Inventory, CR Opening Balance)
    if (data.trackInventory && (data.openingQty ?? 0) > 0) {
      const qty = data.openingQty!;
      const cost = data.openingUnitCostCents ?? data.purchaseCostCents;
      await addLot({ itemId: created.id, date: todayISO(), qty, unitCostCents: cost, sourceType: "opening" });
      const value = Math.round(qty * cost);
      if (value > 0) {
        await postEntry({
          date: todayISO(),
          memo: `Opening stock — ${data.name}`,
          sourceType: "opening_stock",
          sourceId: created.id,
          lines: [
            { accountId: await acct(SYS.INVENTORY), debitCents: value },
            { accountId: await acct(SYS.OPENING_BALANCE), creditCents: value },
          ],
        });
      }
    }
  }
  revalidatePath("/items");
}

export async function adjustStock(itemId: number, qtyDelta: number, unitCostCents: number, reason: string) {
  const value = Math.round(Math.abs(qtyDelta) * unitCostCents);
  if (qtyDelta > 0) {
    await addLot({ itemId, date: todayISO(), qty: qtyDelta, unitCostCents, sourceType: "adjustment" });
    await postEntry({
      date: todayISO(),
      memo: `Stock adjustment (+): ${reason}`,
      sourceType: "inventory_adjustment",
      sourceId: itemId,
      lines: [
        { accountId: await acct(SYS.INVENTORY), debitCents: value },
        { accountId: await acct(SYS.INVENTORY_ADJ), creditCents: value },
      ],
    });
  } else if (qtyDelta < 0) {
    const cogs = await consumeFifo(itemId, -qtyDelta);
    await postEntry({
      date: todayISO(),
      memo: `Stock adjustment (−): ${reason}`,
      sourceType: "inventory_adjustment",
      sourceId: itemId,
      lines: [
        { accountId: await acct(SYS.INVENTORY_ADJ), debitCents: cogs },
        { accountId: await acct(SYS.INVENTORY), creditCents: cogs },
      ],
    });
  }
  revalidatePath("/items");
}

/* ---------------- Documents ---------------- */

export interface DocLineInput {
  itemId?: number | null;
  description: string;
  qty: number;
  unitPriceCents: number;
  discountPct: number;
  taxClass: TaxClass;
  accountId?: number | null;
}

export async function saveDocument(data: {
  id?: number;
  type: "quote" | "invoice" | "credit_note" | "bill" | "purchase_order" | "expense";
  contactId?: number | null;
  date: string;
  dueDate?: string | null;
  taxInclusive: boolean;
  notes?: string;
  billNumber?: string; // vendor's own number for bills
  paidFromBankAccountId?: number | null;
  lines: DocLineInput[];
}): Promise<number> {
  const totals = computeDocument(
    data.lines.map((l) => ({
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      discountPct: l.discountPct,
      taxClass: l.taxClass,
    })),
    data.taxInclusive
  );

  let docId: number;
  if (data.id) {
    const [existing] = await db.select().from(documents).where(eq(documents.id, data.id)).limit(1);
    if (!existing) throw new Error("Document not found");
    if (existing.status !== "draft") throw new Error("Only drafts can be edited");
    await db
      .update(documents)
      .set({
        contactId: data.contactId,
        date: data.date,
        dueDate: data.dueDate,
        taxInclusive: data.taxInclusive,
        notes: data.notes,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        paidFromBankAccountId: data.paidFromBankAccountId,
      })
      .where(eq(documents.id, data.id));
    await db.delete(documentLines).where(eq(documentLines.documentId, data.id));
    docId = data.id;
  } else {
    const number =
      data.type === "bill" || data.type === "expense"
        ? data.billNumber || `${data.type === "bill" ? "BILL" : "EXP"}-${Date.now().toString(36).toUpperCase()}`
        : await nextNumber(data.type as NumberKind);
    const [created] = await db
      .insert(documents)
      .values({
        type: data.type,
        number,
        contactId: data.contactId,
        date: data.date,
        dueDate: data.dueDate,
        taxInclusive: data.taxInclusive,
        notes: data.notes,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        paidFromBankAccountId: data.paidFromBankAccountId,
        createdAt: nowISO(),
      })
      .returning();
    docId = created.id;
  }

  await db.insert(documentLines).values(
    data.lines.map((l, i) => {
      const t = totals.lines[i];
      return {
        documentId: docId,
        itemId: l.itemId,
        description: l.description,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
        discountPct: l.discountPct,
        taxClass: l.taxClass,
        taxRateBp: t.taxRateBp,
        netCents: t.netCents,
        taxCents: t.taxCents,
        grossCents: t.grossCents,
        accountId: l.accountId,
        position: i,
      };
    })
  );

  revalidatePath("/sales");
  revalidatePath("/purchases");
  return docId;
}

/** Issue (post) a draft document. For invoices this also signs via the tax device. */
export async function issueDocument(docId: number) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
  if (!doc) throw new Error("Not found");
  if (doc.status !== "draft") throw new Error("Already issued");

  switch (doc.type) {
    case "invoice": {
      const o = await getOrg();
      const buyer = doc.contactId
        ? (await db.select().from(contacts).where(eq(contacts.id, doc.contactId)).limit(1))[0]
        : null;
      const device = getTaxDevice(o.cuSerial);
      const signed = device.sign({
        sellerPin: o.kraPin ?? "P000000000X",
        buyerPin: buyer?.kraPin,
        invoiceNumber: doc.number,
        totalCents: doc.totalCents,
        taxCents: doc.taxCents,
        dateISO: doc.date,
      });
      await db
        .update(documents)
        .set({ cuInvoiceNumber: signed.cuInvoiceNumber, cuSerial: signed.cuSerial, qrUrl: signed.qrUrl })
        .where(eq(documents.id, docId));
      await postInvoice(docId);
      break;
    }
    case "credit_note":
      await postCreditNote(docId);
      break;
    case "bill":
      await postBill(docId);
      break;
    case "expense":
      await postExpense(docId);
      break;
    case "quote":
    case "purchase_order":
      await db.update(documents).set({ status: "open" }).where(eq(documents.id, docId));
      break;
  }
  revalidatePath("/sales");
  revalidatePath("/purchases");
}

export async function voidDoc(docId: number) {
  await voidDocument(docId, todayISO());
  revalidatePath("/sales");
  revalidatePath("/purchases");
}

export async function markQuote(docId: number, status: "accepted" | "declined") {
  await db.update(documents).set({ status }).where(eq(documents.id, docId));
  revalidatePath("/sales");
}

/** Convert an accepted quote into a draft invoice. */
export async function convertQuoteToInvoice(quoteId: number): Promise<number> {
  const [quote] = await db.select().from(documents).where(eq(documents.id, quoteId)).limit(1);
  if (!quote || quote.type !== "quote") throw new Error("Quote not found");
  const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, quoteId));
  const invoiceId = await saveDocument({
    type: "invoice",
    contactId: quote.contactId,
    date: todayISO(),
    dueDate: null,
    taxInclusive: quote.taxInclusive,
    notes: quote.notes ?? undefined,
    lines: lines.map((l) => ({
      itemId: l.itemId,
      description: l.description,
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      discountPct: l.discountPct,
      taxClass: l.taxClass as TaxClass,
      accountId: l.accountId,
    })),
  });
  await db
    .update(documents)
    .set({ sourceDocId: quoteId, status: "draft" })
    .where(eq(documents.id, invoiceId));
  await db.update(documents).set({ status: "accepted" }).where(eq(documents.id, quoteId));
  return invoiceId;
}

/* ---------------- Payments ---------------- */

export async function recordPayment(data: {
  direction: "in" | "out";
  documentId: number;
  date: string;
  amountCents: number;
  whtCents?: number;
  method: string;
  bankAccountId?: number | null;
  reference?: string;
}) {
  const [doc] = await db.select().from(documents).where(eq(documents.id, data.documentId)).limit(1);
  if (!doc) throw new Error("Document not found");
  const [p] = await db
    .insert(payments)
    .values({
      number: await nextNumber("payment"),
      direction: data.direction,
      contactId: doc.contactId,
      documentId: data.documentId,
      date: data.date,
      amountCents: data.amountCents,
      whtCents: data.whtCents ?? 0,
      method: data.method,
      bankAccountId: data.bankAccountId,
      reference: data.reference,
      createdAt: nowISO(),
    })
    .returning();
  await postPayment(p.id);
  revalidatePath("/sales");
  revalidatePath("/purchases");
  revalidatePath("/");
}

/* ---------------- Banking ---------------- */

export async function addBankTransaction(data: {
  bankAccountId: number;
  date: string;
  description: string;
  amountCents: number;
}) {
  await db.insert(bankTransactions).values({ ...data, createdAt: nowISO() });
  revalidatePath("/banking");
}

/** Categorize an uncategorized bank line: creates the journal. */
export async function categorizeTransaction(txnId: number, categoryAccountId: number) {
  const [txn] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, txnId)).limit(1);
  if (!txn) throw new Error("Transaction not found");
  const [bank] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, txn.bankAccountId))
    .limit(1);
  if (!bank) throw new Error("Bank account not found");
  const amount = Math.abs(txn.amountCents);
  const entryId = await postEntry({
    date: txn.date,
    memo: txn.description,
    sourceType: "bank_txn",
    sourceId: txn.id,
    lines:
      txn.amountCents >= 0
        ? [
            { accountId: bank.accountId, debitCents: amount },
            { accountId: categoryAccountId, creditCents: amount },
          ]
        : [
            { accountId: categoryAccountId, debitCents: amount },
            { accountId: bank.accountId, creditCents: amount },
          ],
  });
  await db
    .update(bankTransactions)
    .set({ status: "categorized", categoryAccountId, journalEntryId: entryId })
    .where(eq(bankTransactions.id, txnId));
  revalidatePath("/banking");
}

/* ---------------- Manual journals ---------------- */

export async function createManualJournal(data: {
  date: string;
  memo: string;
  lines: { accountId: number; debitCents: number; creditCents: number }[];
}) {
  await postEntry({ date: data.date, memo: data.memo, sourceType: "manual", lines: data.lines });
  revalidatePath("/accountant");
}

/* ---------------- Settings ---------------- */

export async function saveOrg(data: {
  name: string;
  kraPin?: string;
  vatRegistered: boolean;
  address?: string;
  phone?: string;
  email?: string;
  invoicePrefix: string;
  logoUrl?: string;
}) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  await db.update(org).set(data).where(eq(org.userId, user.id));
  revalidatePath("/settings");
}

/** Save org profile from onboarding or settings (includes logo URL). */
export async function saveOrgProfile(data: {
  name: string;
  kraPin?: string;
  vatRegistered: boolean;
  address?: string;
  phone?: string;
  email?: string;
  invoicePrefix: string;
  logoUrl?: string;
}) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  await db
    .insert(org)
    .values({
      userId: user.id,
      name: data.name,
      kraPin: data.kraPin,
      vatRegistered: data.vatRegistered,
      address: data.address,
      phone: data.phone,
      email: data.email,
      invoicePrefix: data.invoicePrefix || "INV-",
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
    })
    .onConflictDoUpdate({
      target: org.userId,
      set: {
        name: data.name,
        kraPin: data.kraPin,
        vatRegistered: data.vatRegistered,
        address: data.address,
        phone: data.phone,
        email: data.email,
        invoicePrefix: data.invoicePrefix || "INV-",
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      },
    });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function getTaxClasses() {
  return TAX_CLASSES;
}
