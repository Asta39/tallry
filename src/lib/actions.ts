"use server";
import { getAccess } from "@/lib/access";

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
  documentAssignments,
  notifications,
} from "@/db";
import { eq, and, desc } from "drizzle-orm";
import { currentOrgId, withOrg, seedOrgDefaults } from "@/lib/org";
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
import { ETIMS_ENABLED } from "./features";
import { getUser } from "./supabase/server";

/** revalidatePath, but safe when called outside a Next request (scripts, tests). */
function revalidatePath(path: string, type?: "page" | "layout") {
  try {
    nextRevalidatePath(path, type);
  } catch {
    /* running outside Next request context */
  }
}

import { getOrg } from "@/lib/org";

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
    .where(eq(org.id, o.id));
  return `${prefixes[kind]}${String(n).padStart(4, "0")}`;
}

/* ---------------- Contacts & CRM ---------------- */

async function _saveContact(data: {
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
    await db.update(contacts).set({ ...data, id: undefined }).where(and(eq(contacts.orgId, currentOrgId()), eq(contacts.id, data.id)));
  } else {
    await db.insert(contacts).values({ orgId: currentOrgId(), ...data, createdAt: nowISO() });
  }
  revalidatePath("/contacts");
}

async function _addActivity(contactId: number, kind: string, content: string) {
  await db
    .insert(activities)
    .values({ orgId: currentOrgId(), contactId, kind, content, date: todayISO(), createdAt: nowISO() });
  revalidatePath(`/contacts/${contactId}`);
}

async function _saveDeal(data: {
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
      .where(and(eq(deals.orgId, currentOrgId()), eq(deals.id, data.id)));
  } else {
    await db.insert(deals).values({ orgId: currentOrgId(), ...data, createdAt: nowISO(), updatedAt: nowISO() });
  }
  revalidatePath("/pipeline");
}

async function _moveDealStage(dealId: number, stage: string) {
  await db.update(deals).set({ stage, updatedAt: nowISO() }).where(and(eq(deals.orgId, currentOrgId()), eq(deals.id, dealId)));
  revalidatePath("/pipeline");
}

/* ---------------- Items ---------------- */

async function _saveItem(data: {
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
  const [salesAcc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, currentOrgId()), eq(accounts.code, SYS.SALES)))
    .limit(1);
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
      .where(and(eq(items.orgId, currentOrgId()), eq(items.id, data.id)));
  } else {
    const [created] = await db
      .insert(items)
      .values({ orgId: currentOrgId(),
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

async function _adjustStock(itemId: number, qtyDelta: number, unitCostCents: number, reason: string) {
  const value = Math.round(Math.abs(qtyDelta) * unitCostCents);
  if (qtyDelta > 0) {
    await addLot({ itemId, date: todayISO(), qty: qtyDelta, unitCostCents, sourceType: "adjustment" });
    // Only post a journal when there's a value to move — a qty-only adjustment
    // (no cost) still tracks stock but has zero ledger effect.
    if (value > 0) {
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
    }
  } else if (qtyDelta < 0) {
    const cogs = await consumeFifo(itemId, -qtyDelta);
    if (cogs > 0) {
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
  customColumnValue?: string | null;
}

async function _saveDocument(data: {
  id?: number;
  type: "quote" | "invoice" | "credit_note" | "bill" | "purchase_order" | "expense";
  contactId?: number | null;
  date: string;
  dueDate?: string | null;
  taxInclusive: boolean;
  notes?: string;
  billNumber?: string; // vendor's own number for bills
  paidFromBankAccountId?: number | null;
  assignedMemberIds?: number[];
  isTemplate?: boolean;
  saveAsTemplate?: boolean;
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
    const [existing] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.id))).limit(1);
    if (!existing) throw new Error("Document not found");
    let newStatus = existing.status;
    if (existing.type === "quote") {
      if (existing.status !== "draft" && existing.status !== "open") throw new Error("Only draft or open quotes can be edited");
    } else if (existing.type === "invoice") {
      if (!["draft", "open", "partial"].includes(existing.status)) throw new Error("Only draft, open, or partial invoices can be edited");
      if (existing.status !== "draft") {
        if (totals.totalCents <= existing.paidCents) {
          newStatus = "paid";
        } else if (existing.paidCents > 0) {
          newStatus = "partial";
        } else {
          newStatus = "open";
        }
      }
    } else {
      if (existing.status !== "draft") throw new Error("Only drafts can be edited");
    }
    await db
      .update(documents)
      .set({
        status: newStatus,
        contactId: data.contactId,
        date: data.date,
        dueDate: data.dueDate,
        taxInclusive: data.taxInclusive,
        notes: data.notes,
        subtotalCents: totals.subtotalCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        isTemplate: data.isTemplate || false,
        paidFromBankAccountId: data.paidFromBankAccountId,
      })
      .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.id)));
    await db.delete(documentLines).where(eq(documentLines.documentId, data.id));
    docId = data.id;
  } else {
    const number =
      data.type === "bill" || data.type === "expense"
        ? data.billNumber || `${data.type === "bill" ? "BILL" : "EXP"}-${Date.now().toString(36).toUpperCase()}`
        : await nextNumber(data.type as NumberKind);
    const [created] = await db
      .insert(documents)
      .values({ orgId: currentOrgId(),
        type: data.type,
        number,
        contactId: data.contactId,
        date: data.date,
        dueDate: data.dueDate,
        taxInclusive: data.taxInclusive,
        isTemplate: data.isTemplate || false,
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
        orgId: currentOrgId(),
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
        customColumnValue: l.customColumnValue || null,
      };
    })
  );

  if (data.assignedMemberIds) {
    const orgId = currentOrgId();
    await db.delete(documentAssignments).where(and(eq(documentAssignments.orgId, orgId), eq(documentAssignments.documentId, docId)));
    if (data.assignedMemberIds.length > 0) {
      await db.insert(documentAssignments).values(
        data.assignedMemberIds.map((memberId) => ({
          orgId,
          documentId: docId,
          memberId,
          createdAt: nowISO(),
        }))
      );

      // Insert notifications for assignments
      await db.insert(notifications).values(
        data.assignedMemberIds.map((memberId) => ({
          orgId,
          memberId,
          title: "New Assignment",
          body: `You have been assigned to ${data.type} #${docId}`,
          link: `/${data.type === "quote" ? "sales/quotes" : "sales/invoices"}/${docId}`,
          createdAt: nowISO(),
        }))
      );
    }
  }

  revalidatePath("/sales");
  revalidatePath("/purchases");

  if (data.saveAsTemplate) {
    await _saveDocument({
      ...data,
      id: undefined, // Create a new record
      isTemplate: true,
      saveAsTemplate: false, // Prevent infinite loop
    });
  }

  return docId;
}

/** Issue (post) a draft document. For invoices this also signs via the tax device. */
async function _issueDocument(docId: number) {
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId))).limit(1);
  if (!doc) throw new Error("Not found");
  if (doc.status !== "draft") throw new Error("Already issued");

  switch (doc.type) {
    case "invoice": {
      // KRA eTIMS signing — gated behind ETIMS_ENABLED (off until a real
      // OSCU/reseller integration is in place). When off, no CU number/QR is
      // generated and the eTIMS blocks on views/PDFs stay hidden. See
      // src/lib/features.ts and src/lib/etims.ts — nothing is removed.
      if (ETIMS_ENABLED) {
        const o = await getOrg();
        const buyer = doc.contactId
          ? (await db.select().from(contacts).where(and(eq(contacts.orgId, currentOrgId()), eq(contacts.id, doc.contactId))).limit(1))[0]
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
          .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
      }
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
      await db.update(documents).set({ status: "open" }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
      break;
  }
  revalidatePath("/sales");
  revalidatePath("/purchases");
}

async function _voidDoc(docId: number) {
  await voidDocument(docId, todayISO());
  revalidatePath("/sales");
  revalidatePath("/purchases");
}

async function _markQuote(docId: number, status: "accepted" | "declined") {
  await db.update(documents).set({ status }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
  revalidatePath("/sales");
}

/** Convert an accepted quote into a draft invoice. */
async function _convertQuoteToInvoice(quoteId: number): Promise<number> {
  const [quote] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, quoteId))).limit(1);
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
      customColumnValue: l.customColumnValue,
    })),
  });
  await db
    .update(documents)
    .set({ sourceDocId: quoteId, status: "draft" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, invoiceId)));
  await db.update(documents).set({ status: "accepted" }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, quoteId)));
  return invoiceId;
}

/* ---------------- Payments ---------------- */

async function _recordPayment(data: {
  direction: "in" | "out";
  documentId: number;
  date: string;
  amountCents: number;
  whtCents?: number;
  method: string;
  bankAccountId?: number | null;
  reference?: string;
}) {
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.documentId))).limit(1);
  if (!doc) throw new Error("Document not found");
  const [p] = await db
    .insert(payments)
    .values({ orgId: currentOrgId(),
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

/* ---------------- Notifications ---------------- */

export async function getNotifications(memberId: number) {
  return withOrg(async () => {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.orgId, currentOrgId()), eq(notifications.memberId, memberId)))
      .orderBy(desc(notifications.id))
      .limit(20);
  });
}

export async function markNotificationRead(id: number) {
  return withOrg(async () => {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.orgId, currentOrgId()), eq(notifications.id, id)));
    revalidatePath("/", "layout");
  });
}

/* ---------------- Banking ---------------- */

async function _addBankTransaction(data: {
  bankAccountId: number;
  date: string;
  description: string;
  amountCents: number;
}) {
  await db.insert(bankTransactions).values({ orgId: currentOrgId(), ...data, createdAt: nowISO() });
  revalidatePath("/banking");
}

/** Categorize an uncategorized bank line: creates the journal. */
async function _categorizeTransaction(txnId: number, categoryAccountId: number) {
  const [txn] = await db.select().from(bankTransactions).where(eq(bankTransactions.id, txnId)).limit(1);
  if (!txn) throw new Error("Transaction not found");
  const [bank] = await db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.orgId, currentOrgId()), eq(bankAccounts.id, txn.bankAccountId)))
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
  // Learn: remember this description→account choice for future imports
  const { learnRule } = await import("./categorization");
  await learnRule(txn.description, txn.amountCents >= 0 ? "in" : "out", categoryAccountId);
  revalidatePath("/banking");
}

async function _bulkCategorizeTransactions(updates: { txnId: number; categoryAccountId: number }[]) {
  for (const { txnId, categoryAccountId } of updates) {
    await _categorizeTransaction(txnId, categoryAccountId);
  }
  revalidatePath("/banking");
}

/* ---------------- Manual journals ---------------- */

async function _createManualJournal(data: {
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
  brandColor?: string;
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
  invoiceTemplate?: string;
  quoteTemplate?: string;
  logoUrl?: string;
  brandColor?: string;
  customDocumentColumnName?: string;
  documentFooterText?: string;
  dataSegregation?: boolean;
}) {
  const user = await getUser();
  if (!user) throw new Error("Not authenticated");
  
  const access = await getAccess();
  
  if (access) {
    if (!access.isOwner && access.role !== "admin") {
      throw new Error("Not authorized to update org settings");
    }
    await db
      .update(org)
      .set({
        name: data.name,
        kraPin: data.kraPin,
        vatRegistered: data.vatRegistered,
        address: data.address,
        phone: data.phone,
        email: data.email,
        invoicePrefix: data.invoicePrefix || "INV-",
        ...(data.invoiceTemplate !== undefined ? { invoiceTemplate: data.invoiceTemplate } : {}),
        ...(data.quoteTemplate !== undefined ? { quoteTemplate: data.quoteTemplate } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.brandColor !== undefined ? { brandColor: data.brandColor } : {}),
        ...(data.customDocumentColumnName !== undefined ? { customDocumentColumnName: data.customDocumentColumnName } : {}),
        ...(data.documentFooterText !== undefined ? { documentFooterText: data.documentFooterText } : {}),
        ...(data.dataSegregation !== undefined ? { dataSegregation: data.dataSegregation } : {}),
      })
      .where(eq(org.id, access.orgId));
  } else {
    const [saved] = await db
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
        ...(data.invoiceTemplate !== undefined ? { invoiceTemplate: data.invoiceTemplate } : {}),
        ...(data.quoteTemplate !== undefined ? { quoteTemplate: data.quoteTemplate } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
        ...(data.brandColor !== undefined ? { brandColor: data.brandColor } : {}),
        ...(data.customDocumentColumnName !== undefined ? { customDocumentColumnName: data.customDocumentColumnName } : {}),
        ...(data.documentFooterText !== undefined ? { documentFooterText: data.documentFooterText } : {}),
        ...(data.dataSegregation !== undefined ? { dataSegregation: data.dataSegregation } : {}),
      })
      .returning();
    await seedOrgDefaults(saved.id);
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function getTaxClasses() {
  return TAX_CLASSES;
}

/* ---- org-context wrappers: every action runs inside withOrg so currentOrgId() is set ---- */
export async function saveContact(data: Parameters<typeof _saveContact>[0]) {
  return withOrg(() => _saveContact(data));
}
export async function addActivity(contactId: number, kind: string, content: string) {
  return withOrg(() => _addActivity(contactId, kind, content));
}
export async function saveDeal(data: Parameters<typeof _saveDeal>[0]) {
  return withOrg(() => _saveDeal(data));
}
export async function moveDealStage(dealId: number, stage: string) {
  return withOrg(() => _moveDealStage(dealId, stage));
}
export async function saveItem(data: Parameters<typeof _saveItem>[0]) {
  return withOrg(() => _saveItem(data));
}
export async function adjustStock(itemId: number, qtyDelta: number, unitCostCents: number, reason: string) {
  return withOrg(() => _adjustStock(itemId, qtyDelta, unitCostCents, reason));
}
export async function saveDocument(data: Parameters<typeof _saveDocument>[0]) {
  const access = await getAccess();
  if (access && !access.isOwner && access.role !== "admin" && access.memberId) {
    data.assignedMemberIds = Array.from(new Set([...(data.assignedMemberIds || []), access.memberId]));
  }
  return withOrg(() => _saveDocument(data));
}
export async function issueDocument(docId: number) {
  return withOrg(() => _issueDocument(docId));
}
export async function voidDoc(docId: number) {
  return withOrg(() => _voidDoc(docId));
}
export async function markQuote(docId: number, status: "accepted" | "declined") {
  return withOrg(() => _markQuote(docId, status));
}
export async function convertQuoteToInvoice(quoteId: number) {
  return withOrg(() => _convertQuoteToInvoice(quoteId));
}
export async function recordPayment(data: Parameters<typeof _recordPayment>[0]) {
  return withOrg(() => _recordPayment(data));
}
export async function addBankTransaction(data: Parameters<typeof _addBankTransaction>[0]) {
  return withOrg(() => _addBankTransaction(data));
}
export async function categorizeTransaction(txnId: number, categoryAccountId: number) {
  return withOrg(() => _categorizeTransaction(txnId, categoryAccountId));
}
export async function bulkCategorizeTransactions(updates: { txnId: number; categoryAccountId: number }[]) {
  return withOrg(() => _bulkCategorizeTransactions(updates));
}
export async function createManualJournal(data: Parameters<typeof _createManualJournal>[0]) {
  return withOrg(() => _createManualJournal(data));
}

/* ---------------- Credit note from invoice / PO → bill ---------------- */

async function _createCreditNoteFromInvoice(invoiceId: number): Promise<number> {
  const [inv] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, invoiceId)))
    .limit(1);
  if (!inv || inv.type !== "invoice") throw new Error("Invoice not found");
  const lines = await db
    .select()
    .from(documentLines)
    .where(and(eq(documentLines.orgId, currentOrgId()), eq(documentLines.documentId, invoiceId)));
  const cnId = await _saveDocument({
    type: "credit_note",
    contactId: inv.contactId,
    date: todayISO(),
    taxInclusive: inv.taxInclusive,
    notes: `Credit note for invoice ${inv.number}`,
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
    .set({ sourceDocId: invoiceId })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, cnId)));
  return cnId;
}

async function _convertPoToBill(poId: number): Promise<number> {
  const [po] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, poId)))
    .limit(1);
  if (!po || po.type !== "purchase_order") throw new Error("Purchase order not found");
  const lines = await db
    .select()
    .from(documentLines)
    .where(and(eq(documentLines.orgId, currentOrgId()), eq(documentLines.documentId, poId)));
  const billId = await _saveDocument({
    type: "bill",
    contactId: po.contactId,
    date: todayISO(),
    taxInclusive: po.taxInclusive,
    billNumber: `BILL-${po.number}`,
    notes: po.notes ?? undefined,
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
    .set({ sourceDocId: poId })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, billId)));
  await db
    .update(documents)
    .set({ status: "closed" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, poId)));
  revalidatePath("/purchases");
  return billId;
}

/* ---------------- Bank statement import ---------------- */

async function _importBankTransactions(
  bankAccountId: number,
  rows: { date: string; description: string; amountCents: number }[]
): Promise<number> {
  const valid = rows.filter((r) => r.date && r.amountCents !== 0);
  if (valid.length === 0) return 0;
  await db.insert(bankTransactions).values(
    valid.map((r) => ({
      orgId: currentOrgId(),
      bankAccountId,
      date: r.date,
      description: r.description || "Imported transaction",
      amountCents: r.amountCents,
      createdAt: nowISO(),
    }))
  );
  revalidatePath("/banking");
  return valid.length;
}

export async function createCreditNoteFromInvoice(invoiceId: number) {
  return withOrg(() => _createCreditNoteFromInvoice(invoiceId));
}
export async function convertPoToBill(poId: number) {
  return withOrg(() => _convertPoToBill(poId));
}
export async function importBankTransactions(
  bankAccountId: number,
  rows: { date: string; description: string; amountCents: number }[]
) {
  return withOrg(() => _importBankTransactions(bankAccountId, rows));
}

/* ---------------- Categorization rules ---------------- */

export async function applyCategorizationRules(): Promise<{ applied: number }> {
  return withOrg(async () => {
    const { applyRulesToUncategorized } = await import("./categorization");
    const updates = await applyRulesToUncategorized();
    for (const { txnId, categoryAccountId } of updates) {
      await _categorizeTransaction(txnId, categoryAccountId);
    }
    revalidatePath("/banking");
    return { applied: updates.length };
  });
}

export async function listCategorizationRules() {
  return withOrg(async () => {
    const { listRules } = await import("./categorization");
    return listRules();
  });
}

export async function deleteCategorizationRule(ruleId: number) {
  return withOrg(async () => {
    const { deleteRule } = await import("./categorization");
    await deleteRule(ruleId);
    revalidatePath("/banking");
  });
}
