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
  customerGroups,
  contactGroupMemberships,
  itemGroups,
} from "@/db";
import { eq, and, ne, desc, isNull, sql, inArray } from "drizzle-orm";
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
import { addLot, consumeFifo, stockOnHand } from "./inventory";
import { SYS } from "./coa";
import { nowISO, todayISO, fmtKES } from "./money";
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
import { notifyOrg } from "@/lib/notifications";
import { logAudit } from "./audit";

async function reportInvoiceIssueDebug(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  // #region debug-point A:server-issue-logger
  try {
    const { readFile } = await import("node:fs/promises");
    const env = await readFile(".dbg/invoice-issue-500.env", "utf8").catch(() => "");
    const url = env.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || "http://127.0.0.1:7777/event";
    const sessionId = env.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || "invoice-issue-500";
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({ sessionId, runId: "pre-fix", hypothesisId, location, msg: `[DEBUG] ${msg}`, data, ts: Date.now() }),
    }).catch(() => {});
  } catch {}
  // #endregion
}

const DOC_MODULE: Record<string, "quotes" | "invoices" | "credit_notes" | "bills" | "purchase_orders" | "expenses"> = {
  quote: "quotes",
  invoice: "invoices",
  credit_note: "credit_notes",
  bill: "bills",
  purchase_order: "purchase_orders",
  expense: "expenses",
};

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

async function nextNumberInTx(kind: NumberKind, tx: any): Promise<string> {
  const [o] = await tx.select().from(org).where(eq(org.id, currentOrgId())).limit(1);
  if (!o) throw new Error("Organization not found");
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
  await tx
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
  /** One or more customer groups. Required (>=1) for customers; ignored for vendors. */
  groupIds?: number[];
}) {
  const orgId = currentOrgId();
  const isCustomer = data.kind === "customer" || data.kind === "both";

  // Groups apply to customers only; a vendor-only contact never carries any.
  let groupIds = isCustomer ? [...new Set((data.groupIds ?? []).filter(Boolean))] : [];
  if (isCustomer) {
    if (groupIds.length === 0) throw new Error("Pick at least one customer group");
    const valid = await db
      .select({ id: customerGroups.id })
      .from(customerGroups)
      .where(and(eq(customerGroups.orgId, orgId), inArray(customerGroups.id, groupIds)));
    if (valid.length !== groupIds.length) throw new Error("One of the chosen groups no longer exists");
  }

  const values = {
    kind: data.kind,
    displayName: data.displayName,
    companyName: data.companyName,
    email: data.email,
    phone: data.phone,
    kraPin: data.kraPin,
    address: data.address,
    city: data.city,
    notes: data.notes,
    isWithholdingAgent: data.isWithholdingAgent,
    // Keep the legacy single-group column pointed at the first group for any
    // old read path; the membership table below is the source of truth.
    groupId: groupIds[0] ?? null,
  };

  let contactId = data.id;
  if (data.id) {
    await db.update(contacts).set(values).where(and(eq(contacts.orgId, orgId), eq(contacts.id, data.id)));
  } else {
    const [created] = await db.insert(contacts).values({ orgId, ...values, createdAt: nowISO() }).returning();
    contactId = created.id;
  }

  // Replace memberships wholesale — simplest correct way to reconcile add/remove.
  await db.delete(contactGroupMemberships).where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.contactId, contactId!)));
  if (groupIds.length > 0) {
    await db.insert(contactGroupMemberships).values(groupIds.map((gid) => ({ orgId, contactId: contactId!, groupId: gid })));
  }

  revalidatePath("/contacts");
  if (data.id) revalidatePath(`/contacts/${data.id}`);
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

async function validateItemGroup(orgId: number, itemGroupId: number | null | undefined) {
  const o = await getOrg();
  const groupId = itemGroupId ?? null;
  if (o.itemGroupsEnabled && !groupId) {
    throw new Error("Pick an item group");
  }
  if (groupId) {
    const [group] = await db
      .select({ id: itemGroups.id })
      .from(itemGroups)
      .where(and(eq(itemGroups.orgId, orgId), eq(itemGroups.id, groupId)))
      .limit(1);
    if (!group) throw new Error("The chosen item group no longer exists");
  }
  return groupId;
}

async function _moveDealStage(dealId: number, stage: string) {
  await db.update(deals).set({ stage, updatedAt: nowISO() }).where(and(eq(deals.orgId, currentOrgId()), eq(deals.id, dealId)));
  revalidatePath("/pipeline");
}

/* ---------------- Invoice & Billable Expenses Combination ---------------- */

export async function getInvoiceWithBillableExpenses(docId: number, orgId: number) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, docId)))
    .limit(1);

  if (!doc) return null;

  const lineRows = await db
    .select({ line: documentLines, itemName: items.name })
    .from(documentLines)
    .leftJoin(items, eq(documentLines.itemId, items.id))
    .where(and(eq(documentLines.orgId, orgId), eq(documentLines.documentId, docId)));

  const baseLines = lineRows.map((r) => ({ ...r.line, itemName: r.itemName }));

  if (doc.type !== "invoice") {
    return { doc, lines: baseLines };
  }

  // Find linked expenses/bills for this invoice
  const linkedExpenses = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.relatedInvoiceId, docId),
        eq(documents.isBillable, true)
      )
    );

  if (linkedExpenses.length === 0) {
    return { doc, lines: baseLines };
  }

  // Get line descriptions for linked expenses
  const expenseIds = linkedExpenses.map((e) => e.id);
  const expenseLines = await db
    .select({ line: documentLines })
    .from(documentLines)
    .where(and(eq(documentLines.orgId, orgId), inArray(documentLines.documentId, expenseIds)));

  const expLinesMap = new Map<number, string[]>();
  for (const el of expenseLines) {
    const arr = expLinesMap.get(el.line.documentId) || [];
    if (el.line.description) arr.push(el.line.description);
    expLinesMap.set(el.line.documentId, arr);
  }

  let additionalSubtotalCents = 0;
  const billableLines = linkedExpenses.map((exp) => {
    const lineDescs = expLinesMap.get(exp.id) || [];
    const expDetail = lineDescs.join("; ") || exp.notes || "Out-of-pocket expense";
    const fullDesc = `Billable Expense (${exp.number}): ${expDetail}`;
    additionalSubtotalCents += exp.totalCents;

    return {
      id: -exp.id,
      orgId,
      documentId: docId,
      itemId: null,
      itemName: "Billable Expense",
      description: fullDesc,
      qty: 1,
      unitPriceCents: exp.totalCents,
      discountPct: 0,
      taxClass: "D_NONVAT",
      taxRateBp: 0,
      netCents: exp.totalCents,
      taxCents: 0,
      grossCents: exp.totalCents,
      customColumnValue: null,
      billedQty: 0,
    };
  });

  const combinedDoc = {
    ...doc,
    subtotalCents: doc.subtotalCents + additionalSubtotalCents,
    totalCents: doc.totalCents + additionalSubtotalCents,
  };

  return {
    doc: combinedDoc,
    lines: [...baseLines, ...billableLines],
  };
}

/* ---------------- Items ---------------- */

async function _saveItem(data: {
  id?: number;
  kind: string;
  itemGroupId?: number | null;
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
  const orgId = currentOrgId();
  const itemGroupId = await validateItemGroup(orgId, data.itemGroupId);

  // Defense-in-depth: the UI constrains these, but the action itself shouldn't
  // trust client input — a negative price/cost would post reversed debit/credit
  // amounts to the ledger, and an invalid tax class would silently fall through
  // TAX_CLASSES lookups elsewhere.
  data.salePriceCents = Math.max(0, Math.round(data.salePriceCents));
  data.purchaseCostCents = Math.max(0, Math.round(data.purchaseCostCents));
  data.reorderLevel = Math.max(0, data.reorderLevel);
  if (!(data.taxClass in TAX_CLASSES)) data.taxClass = "B16";

  // SKU uniqueness (per org) — a duplicate SKU corrupts SKU-based lookups/reports.
  const sku = data.sku?.trim() || null;
  data.sku = sku ?? undefined;
  if (sku) {
    const dupeConds = [eq(items.orgId, orgId), eq(items.sku, sku)];
    if (data.id) dupeConds.push(ne(items.id, data.id));
    const [dupe] = await db.select({ id: items.id }).from(items).where(and(...dupeConds)).limit(1);
    if (dupe) throw new Error(`SKU "${sku}" is already used by another item`);
  }

  if (data.id) {
    const [existing] = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.id, data.id))).limit(1);
    if (existing && existing.trackInventory !== data.trackInventory) {
      const onHand = await stockOnHand(data.id);
      if (existing.trackInventory && !data.trackInventory && onHand !== 0) {
        throw new Error(`Can't stop tracking inventory while ${onHand} units are still on hand — adjust stock to zero first`);
      }
      if (!existing.trackInventory && data.trackInventory) {
        throw new Error("Turning on inventory tracking for an existing item needs an opening-stock adjustment afterward — use Stock Adjust to record what's on hand");
      }
    }
  }

  const [salesAcc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.orgId, currentOrgId()), eq(accounts.code, SYS.SALES)))
    .limit(1);
  let itemId = data.id;
  if (data.id) {
    await db
      .update(items)
      .set({
        kind: data.kind,
        itemGroupId,
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
        itemGroupId,
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
    itemId = created.id;
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
  return itemId!;
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
  costCenterId?: number | null;
  warehouseId?: number | null;
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
  /** Expense/bill cost attribution — the customer the cost was incurred for. */
  customerContactId?: number | null;
  /** Invoice this cost was rebilled on. Must belong to customerContactId. */
  relatedInvoiceId?: number | null;
  isBillable?: boolean;
  assignedMemberIds?: number[];
  isTemplate?: boolean;
  saveAsTemplate?: boolean;
  createdByName?: string;
  createdByRole?: string;
  lines: DocLineInput[];
}): Promise<number> {
  // Cost attribution only applies to money going out. Silently drop it on sales
  // documents so a stale client payload can't write a nonsensical link.
  if (data.type !== "expense" && data.type !== "bill") {
    data.customerContactId = null;
    data.relatedInvoiceId = null;
    data.isBillable = false;
  }
  if (data.relatedInvoiceId && !data.customerContactId) {
    throw new Error("Pick the customer before linking an invoice");
  }
  if (data.relatedInvoiceId) {
    // Never trust the client's pairing — verify the invoice is ours, is an
    // invoice, and actually belongs to the customer being tagged.
    const [inv] = await db
      .select({ id: documents.id, contactId: documents.contactId, type: documents.type })
      .from(documents)
      .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.relatedInvoiceId)))
      .limit(1);
    if (!inv || inv.type !== "invoice") throw new Error("Linked invoice not found");
    if (inv.contactId !== data.customerContactId) {
      throw new Error("That invoice belongs to a different customer");
    }
  }

  const totals = computeDocument(
    data.lines.map((l) => ({
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      discountPct: l.discountPct,
      taxClass: l.taxClass,
    })),
    data.taxInclusive
  );

  const docId = await db.transaction(async (tx) => {
    let savedDocId: number;
    if (data.id) {
      const [existing] = await tx.select().from(documents).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.id))).limit(1);
      if (!existing) throw new Error("Document not found");
      const newStatus = existing.status;
      if (existing.type === "quote") {
        if (existing.status !== "draft" && existing.status !== "open") throw new Error("Only draft or open quotes can be edited");
      } else if (existing.type === "invoice") {
        if (existing.status !== "draft") throw new Error("Issued invoices can't be edited — void and reissue instead");
      } else {
        if (existing.status !== "draft") throw new Error("Only drafts can be edited");
      }
      await tx
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
          customerContactId: data.customerContactId ?? null,
          relatedInvoiceId: data.relatedInvoiceId ?? null,
          isBillable: data.isBillable ?? false,
        })
        .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, data.id)));
      await tx.delete(documentLines).where(eq(documentLines.documentId, data.id));
      savedDocId = data.id;
    } else {
      const number =
        data.type === "bill" || data.type === "expense"
          ? data.billNumber || `${data.type === "bill" ? "BILL" : "EXP"}-${Date.now().toString(36).toUpperCase()}`
          : await nextNumberInTx(data.type as NumberKind, tx);
      const [created] = await tx
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
          customerContactId: data.customerContactId ?? null,
          relatedInvoiceId: data.relatedInvoiceId ?? null,
          isBillable: data.isBillable ?? false,
          createdByName: data.createdByName,
          createdByRole: data.createdByRole,
          createdAt: nowISO(),
        })
        .returning();
      savedDocId = created.id;
    }

    await tx.insert(documentLines).values(
      data.lines.map((l, i) => {
        const t = totals.lines[i];
        return {
          orgId: currentOrgId(),
          documentId: savedDocId,
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
          costCenterId: l.costCenterId || null,
          warehouseId: l.warehouseId || null,
        };
      })
    );

    if (data.assignedMemberIds) {
      const orgId = currentOrgId();
      await tx.delete(documentAssignments).where(and(eq(documentAssignments.orgId, orgId), eq(documentAssignments.documentId, savedDocId)));
      if (data.assignedMemberIds.length > 0) {
        await tx.insert(documentAssignments).values(
          data.assignedMemberIds.map((memberId) => ({
            orgId,
            documentId: savedDocId,
            memberId,
            createdAt: nowISO(),
          }))
        );

        const assignmentPath: Record<string, string> = {
          quote: "sales/quotes",
          invoice: "sales/invoices",
          credit_note: "sales/credit-notes",
          bill: "purchases/bills",
          expense: "purchases/expenses",
          purchase_order: "purchases/orders",
        };
        await tx.insert(notifications).values(
          data.assignedMemberIds.map((memberId) => ({
            orgId,
            memberId,
            title: "New Assignment",
            body: `You have been assigned to ${data.type} #${savedDocId}`,
            link: `/${assignmentPath[data.type] || "sales/invoices"}/${savedDocId}`,
            createdAt: nowISO(),
          }))
        );
      }
    }

    return savedDocId;
  });

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
  const orgId = currentOrgId();
  // #region debug-point D:issue-start
  await reportInvoiceIssueDebug("D", "src/lib/actions.ts:_issueDocument:start", "issue requested", { docId, orgId });
  // #endregion
  // Atomic claim: flips status off "draft" only for the request that gets there
  // first, so two concurrent "Issue" clicks can't both pass the check and both
  // post a journal entry (and, for stocked items, both draw down FIFO stock).
  const [claimed] = await db
    .update(documents)
    .set({ status: "issuing" })
    .where(and(eq(documents.orgId, orgId), eq(documents.id, docId), eq(documents.status, "draft")))
    .returning();
  // #region debug-point D:issue-claim
  await reportInvoiceIssueDebug("D", "src/lib/actions.ts:_issueDocument:claim", "issue claim result", {
    docId,
    claimed: !!claimed,
    claimedType: claimed?.type ?? null,
    claimedStatus: claimed?.status ?? null,
    sourceDocId: claimed?.sourceDocId ?? null,
  });
  // #endregion
  if (!claimed) throw new Error("Already issued");
  const doc = claimed;

  try {
    await _issueClaimedDocument(doc);
  } catch (e) {
    // #region debug-point D:issue-failure
    await reportInvoiceIssueDebug("D", "src/lib/actions.ts:_issueDocument:catch", "issue failed", {
      docId,
      type: doc.type,
      sourceDocId: doc.sourceDocId ?? null,
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack ?? null : null,
    });
    // #endregion
    // Release the claim so the document isn't stuck mid-issue after a failed post.
    await db.update(documents).set({ status: "draft" }).where(and(eq(documents.orgId, orgId), eq(documents.id, docId), eq(documents.status, "issuing")));
    throw e;
  }
}

async function _issueClaimedDocument(doc: typeof documents.$inferSelect) {
  const docId = doc.id;
  // #region debug-point A:claimed-doc
  await reportInvoiceIssueDebug("A", "src/lib/actions.ts:_issueClaimedDocument:start", "issuing claimed document", {
    docId,
    type: doc.type,
    status: doc.status,
    sourceDocId: doc.sourceDocId ?? null,
    contactId: doc.contactId ?? null,
    totalCents: doc.totalCents,
  });
  // #endregion
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
    case "bill": {
      const o = await getOrg();
      if (o.requireBillApproval) {
        await db.update(documents).set({ status: "pending_approval", approvalNote: null }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
        await notifyOrg(currentOrgId(), ["admin", "accountant"], "Bill awaiting approval", `${doc.number} (${fmtKES(doc.totalCents)}) needs approval before it posts.`, `/purchases/bills/${docId}`);
        break;
      }
      await postBill(docId);
      break;
    }
    case "expense":
      await postExpense(docId);
      break;
    case "quote":
      await db.update(documents).set({ status: "open" }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, docId)));
      break;
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
  if (status === "accepted") {
  }
  revalidatePath("/sales");
}

/** Convert an open or accepted quote into a draft invoice. */
async function _convertQuoteToInvoice(quoteId: number): Promise<number> {
  const orgId = currentOrgId();
  // Atomic claim: a double-click (or a second explicit call) on an
  // already-converted quote must not create a second, independent invoice.
  // Both "open" and "accepted" are convertible — this previously excluded
  // "accepted" instead of requiring it, so an accepted quote (the normal,
  // expected case) could never actually be converted; it always failed with
  // "already converted" even on the very first attempt.
  const [quote] = await db
    .update(documents)
    .set({ status: "converting" })
    .where(and(eq(documents.orgId, orgId), eq(documents.id, quoteId), eq(documents.type, "quote"), inArray(documents.status, ["open", "accepted"])))
    .returning();
  if (!quote) throw new Error("This quote was already converted to an invoice");
  const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, quoteId));
  let invoiceId: number;
  try {
    invoiceId = await _convertQuoteToInvoiceInner(quote, lines);
  } catch (e) {
    // Restore whatever status it actually held (open or accepted) rather than
    // hardcoding "open", which would silently discard an acceptance on failure.
    await db.update(documents).set({ status: quote.status }).where(and(eq(documents.orgId, orgId), eq(documents.id, quoteId), eq(documents.status, "converting")));
    throw e;
  }
  return invoiceId;
}

async function _convertQuoteToInvoiceInner(quote: typeof documents.$inferSelect, lines: (typeof documentLines.$inferSelect)[]): Promise<number> {
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
      costCenterId: l.costCenterId,
      warehouseId: l.warehouseId,
    })),
  });
  await db
    .update(documents)
    .set({ sourceDocId: quote.id, status: "draft" })
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, invoiceId)));
  // Terminal state — NOT "accepted". Resting a converted quote back at
  // "accepted" put it back in the set the atomic claim above treats as
  // convertible, so a second click (or a retried request) could claim it
  // again and generate a second, independent invoice from the same quote.
  await db.update(documents).set({ status: "converted" }).where(and(eq(documents.orgId, currentOrgId()), eq(documents.id, quote.id)));
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
  return p.id;
}

/* ---------------- Notifications ---------------- */

export async function getNotifications(memberId: number | null) {
  return withOrg(async () => {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.orgId, currentOrgId()),
          memberId ? eq(notifications.memberId, memberId) : isNull(notifications.memberId)
        )
      )
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

export async function markAllNotificationsRead(memberId: number | null) {
  return withOrg(async () => {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.orgId, currentOrgId()),
          memberId ? eq(notifications.memberId, memberId) : isNull(notifications.memberId),
          eq(notifications.isRead, false)
        )
      );
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
  const orgId = currentOrgId();
  // Atomic claim: only the first request to hit this sees status flip from
  // "uncategorized" — a concurrent double-click or bulk-select overlap on the
  // same row is rejected instead of posting the same bank movement twice.
  const [claimed] = await db
    .update(bankTransactions)
    .set({ status: "categorizing" })
    .where(and(eq(bankTransactions.orgId, orgId), eq(bankTransactions.id, txnId), eq(bankTransactions.status, "uncategorized")))
    .returning();
  if (!claimed) throw new Error("This transaction was already categorized");
  const txn = claimed;
  try {
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
  } catch (e) {
    // Release the claim so the transaction isn't stuck "categorizing" forever after a failed post.
    await db.update(bankTransactions).set({ status: "uncategorized" }).where(and(eq(bankTransactions.id, txnId), eq(bankTransactions.status, "categorizing")));
    throw e;
  }
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
  paymentInfoText?: string;
  termsText?: string;
  dataSegregation?: boolean;
  requireBillApproval?: boolean;
  timeTrackingEnabled?: boolean;
  itemGroupsEnabled?: boolean;
  nextInvoiceNo?: number;
  nextQuoteNo?: number;
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
        ...(data.paymentInfoText !== undefined ? { paymentInfoText: data.paymentInfoText } : {}),
        ...(data.termsText !== undefined ? { termsText: data.termsText } : {}),
        ...(data.dataSegregation !== undefined ? { dataSegregation: data.dataSegregation } : {}),
        ...(data.requireBillApproval !== undefined ? { requireBillApproval: data.requireBillApproval } : {}),
        ...(data.timeTrackingEnabled !== undefined ? { timeTrackingEnabled: data.timeTrackingEnabled } : {}),
        ...(data.itemGroupsEnabled !== undefined ? { itemGroupsEnabled: data.itemGroupsEnabled } : {}),
        ...(data.nextInvoiceNo !== undefined ? { nextInvoiceNo: data.nextInvoiceNo } : {}),
        ...(data.nextQuoteNo !== undefined ? { nextQuoteNo: data.nextQuoteNo } : {}),
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
        ...(data.paymentInfoText !== undefined ? { paymentInfoText: data.paymentInfoText } : {}),
        ...(data.termsText !== undefined ? { termsText: data.termsText } : {}),
        ...(data.dataSegregation !== undefined ? { dataSegregation: data.dataSegregation } : {}),
        ...(data.requireBillApproval !== undefined ? { requireBillApproval: data.requireBillApproval } : {}),
        ...(data.nextInvoiceNo !== undefined ? { nextInvoiceNo: data.nextInvoiceNo } : {}),
        ...(data.nextQuoteNo !== undefined ? { nextQuoteNo: data.nextQuoteNo } : {}),
        ...(data.timeTrackingEnabled !== undefined ? { timeTrackingEnabled: data.timeTrackingEnabled } : {}),
        ...(data.itemGroupsEnabled !== undefined ? { itemGroupsEnabled: data.itemGroupsEnabled } : {}),
      })
      .returning();
    await seedOrgDefaults(saved.id);
  }

  await logAudit({ action: "update", module: "settings", recordLabel: "Organization profile" });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function getTaxClasses() {
  return TAX_CLASSES;
}

/* ---- org-context wrappers: every action runs inside withOrg so currentOrgId() is set ---- */
export async function saveContact(data: Parameters<typeof _saveContact>[0]) {
  const result = await withOrg(() => _saveContact(data));
  await logAudit({
    action: data.id ? "update" : "create",
    module: "contacts",
    recordId: data.id ?? null,
    recordLabel: data.displayName,
  });
  return result;
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

/**
 * Creates a new item on the fly from a bill/PO line for a product not yet in
 * the Items list, then notifies admins/accountants it was added.
 */
export async function createItemFromLine(data: {
  name: string;
  purchaseCostCents: number;
  taxClass: string;
  itemGroupId?: number | null;
}) {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const id = await _saveItem({
      kind: "goods",
      itemGroupId: data.itemGroupId,
      name: data.name,
      unit: "unit",
      salePriceCents: 0,
      purchaseCostCents: data.purchaseCostCents,
      taxClass: data.taxClass,
      trackInventory: true,
      reorderLevel: 0,
    });
    await notifyOrg(orgId, ["admin", "accountant"], "New item added", `"${data.name}" was added to Items from a purchase.`, "/items");
    return id;
  });
}
export async function adjustStock(itemId: number, qtyDelta: number, unitCostCents: number, reason: string) {
  const result = await withOrg(() => _adjustStock(itemId, qtyDelta, unitCostCents, reason));
  const [item] = await db.select({ name: items.name }).from(items).where(eq(items.id, itemId)).limit(1);
  await logAudit({
    action: "adjust",
    module: "items",
    recordId: itemId,
    recordLabel: item?.name,
    detail: `${qtyDelta > 0 ? "+" : ""}${qtyDelta} — ${reason}`,
  });
  return result;
}
export async function saveDocument(data: Parameters<typeof _saveDocument>[0]) {
  const access = await getAccess();
  if (access && !access.isOwner && access.role !== "admin" && access.memberId) {
    data.assignedMemberIds = Array.from(new Set([...(data.assignedMemberIds || []), access.memberId]));
  }
  // Snapshot the creator on new documents only — editing a draft shouldn't reassign authorship.
  if (!data.id && access) {
    data.createdByName = access.memberName;
    data.createdByRole = access.isOwner ? "owner" : access.role;
  }
  // Plan cap covers new invoices/quotes only — editing a draft or creating
  // bills/expenses/etc doesn't consume it. Server-side check: the page-level
  // UpgradePrompt is cosmetic and doesn't stop a direct call to this action.
  if (!data.id && (data.type === "invoice" || data.type === "quote") && access) {
    const { assertInvoiceCapacity } = await import("./billing-server");
    await assertInvoiceCapacity(access.orgId);
  }
  const docId = await withOrg(() => _saveDocument(data), { requireWrite: true });
  const [saved] = await db.select({ number: documents.number }).from(documents).where(eq(documents.id, docId)).limit(1);
  await logAudit({
    action: data.id ? "update" : "create",
    module: DOC_MODULE[data.type],
    recordId: docId,
    recordLabel: saved?.number,
  });
  return docId;
}
export async function upsertDocumentAction(
  input: Parameters<typeof _saveDocument>[0] & { issue?: boolean }
): Promise<{ id?: number; error?: string }> {
  try {
    const { issue, ...data } = input;
    const docId = await saveDocument(data);
    if (issue) await issueDocument(docId);
    return { id: docId };
  } catch (err: any) {
    return { error: err?.message || "Failed to save document" };
  }
}
export async function issueDocument(docId: number) {
  const result = await withOrg(() => _issueDocument(docId), { requireWrite: true });
  const [doc] = await db.select({ number: documents.number, type: documents.type }).from(documents).where(eq(documents.id, docId)).limit(1);
  await logAudit({ action: "issue", module: doc ? DOC_MODULE[doc.type] : "invoices", recordId: docId, recordLabel: doc?.number });
  return result;
}
/** Approve a bill pending approval and post it to the ledger. */
export async function approveBillAction(docId: number) {
  return withOrg(async () => {
    const access = await getAccess();
    if (!access?.perms.has("accountant")) throw new Error("Not authorized to approve bills");
    const orgId = currentOrgId();
    // Atomic claim: only the first "Approve" click flips status off
    // pending_approval — two accountants clicking simultaneously must not
    // both pass the check and both post the bill twice.
    const [claimed] = await db
      .update(documents)
      .set({ status: "approving" })
      .where(and(eq(documents.orgId, orgId), eq(documents.id, docId), eq(documents.type, "bill"), eq(documents.status, "pending_approval")))
      .returning();
    if (!claimed) throw new Error("This bill isn't awaiting approval");
    try {
      await postBill(docId);
    } catch (e) {
      await db.update(documents).set({ status: "pending_approval" }).where(and(eq(documents.orgId, orgId), eq(documents.id, docId), eq(documents.status, "approving")));
      throw e;
    }
    revalidatePath("/purchases/bills");
    await logAudit({ action: "approve", module: "bills", recordId: docId, recordLabel: claimed.number });
    return { success: true };
  }, { requireWrite: true });
}
/** Reject a bill pending approval, sending it back to draft with a note for the submitter. */
export async function rejectBillAction(docId: number, note: string) {
  return withOrg(async () => {
    const access = await getAccess();
    if (!access?.perms.has("accountant")) throw new Error("Not authorized to reject bills");
    const orgId = currentOrgId();
    const [claimed] = await db
      .update(documents)
      .set({ status: "draft", approvalNote: note || "Rejected" })
      .where(and(eq(documents.orgId, orgId), eq(documents.id, docId), eq(documents.type, "bill"), eq(documents.status, "pending_approval")))
      .returning();
    if (!claimed) throw new Error("This bill isn't awaiting approval");
    revalidatePath("/purchases/bills");
    await logAudit({ action: "reject", module: "bills", recordId: docId, recordLabel: claimed.number, detail: note || undefined });
    return { success: true };
  });
}
export async function voidDoc(docId: number) {
  const [doc] = await db.select({ number: documents.number, type: documents.type }).from(documents).where(eq(documents.id, docId)).limit(1);
  const result = await withOrg(() => _voidDoc(docId));
  await logAudit({ action: "void", module: doc ? DOC_MODULE[doc.type] : "invoices", recordId: docId, recordLabel: doc?.number });
  return result;
}
export async function markQuote(docId: number, status: "accepted" | "declined") {
  const result = await withOrg(() => _markQuote(docId, status));
  const [doc] = await db.select({ number: documents.number }).from(documents).where(eq(documents.id, docId)).limit(1);
  await logAudit({ action: status, module: "quotes", recordId: docId, recordLabel: doc?.number });
  return result;
}
export async function convertQuoteToInvoice(quoteId: number) {
  const invId = await withOrg(() => _convertQuoteToInvoice(quoteId));
  const [doc] = await db.select({ number: documents.number }).from(documents).where(eq(documents.id, invId)).limit(1);
  await logAudit({ action: "convert_from_quote", module: "invoices", recordId: invId, recordLabel: doc?.number });
  return invId;
}
export async function recordPayment(data: Parameters<typeof _recordPayment>[0]) {
  const paymentId = await withOrg(() => _recordPayment(data));
  await logAudit({
    action: data.direction === "out" ? "pay_out" : "receive",
    module: "payments",
    recordId: paymentId,
    recordLabel: data.reference || `Payment #${paymentId}`,
    detail: `${fmtKES(data.amountCents)} via ${data.method}`,
  });
  return paymentId;
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
  const result = await withOrg(() => _createManualJournal(data));
  await logAudit({ action: "create", module: "accountant", recordLabel: data.memo || "Manual journal entry" });
  return result;
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

/**
 * Convert a PO to a bill, optionally billing less than the full remaining quantity
 * per line (partial receipt). `lineQtys` maps documentLines.id → qty to bill now;
 * omit a line (or the whole map) to default to its full remaining quantity.
 */
async function _convertPoToBill(poId: number, lineQtys?: Record<number, number>): Promise<number> {
  const orgId = currentOrgId();
  // Atomic claim: a PO can be claimed from "open" (nothing billed yet) or "partial"
  // (some already billed) — but not from "closed" (fully billed) or mid-claim by
  // a concurrent request, closing the original "no guard at all" bug.
  const [po] = await db
    .update(documents)
    .set({ status: "converting" })
    .where(and(
      eq(documents.orgId, orgId), eq(documents.id, poId), eq(documents.type, "purchase_order"),
      sql`${documents.status} IN ('open', 'partial')`
    ))
    .returning();
  if (!po) throw new Error("This purchase order was already fully billed (or isn't open)");
  try {
    const poLines = await db
      .select()
      .from(documentLines)
      .where(and(eq(documentLines.orgId, orgId), eq(documentLines.documentId, poId)));

    const toBill: { line: typeof poLines[number]; qty: number }[] = [];
    for (const l of poLines) {
      const remaining = l.qty - l.billedQty;
      const requested = lineQtys?.[l.id] ?? remaining;
      if (requested < 0) throw new Error(`Can't bill a negative quantity for "${l.description}"`);
      if (requested > remaining + 1e-9) throw new Error(`"${l.description}" only has ${remaining} remaining to bill`);
      if (requested > 0) toBill.push({ line: l, qty: requested });
    }
    if (toBill.length === 0) throw new Error("Nothing left to bill on this purchase order");

    const billId = await _saveDocument({
      type: "bill",
      contactId: po.contactId,
      date: todayISO(),
      taxInclusive: po.taxInclusive,
      billNumber: `BILL-${po.number}`,
      notes: po.notes ?? undefined,
      lines: toBill.map(({ line: l, qty }) => ({
        itemId: l.itemId,
        description: l.description,
        qty,
        unitPriceCents: l.unitPriceCents,
        discountPct: l.discountPct,
        taxClass: l.taxClass as TaxClass,
        accountId: l.accountId,
      })),
    });
    await db
      .update(documents)
      .set({ sourceDocId: poId })
      .where(and(eq(documents.orgId, orgId), eq(documents.id, billId)));

    for (const { line: l, qty } of toBill) {
      await db.update(documentLines).set({ billedQty: l.billedQty + qty }).where(eq(documentLines.id, l.id));
    }
    const fullyBilled = poLines.every((l) => {
      const billedNow = toBill.find((t) => t.line.id === l.id)?.qty ?? 0;
      return l.billedQty + billedNow >= l.qty - 1e-9;
    });
    await db
      .update(documents)
      .set({ status: fullyBilled ? "closed" : "partial" })
      .where(and(eq(documents.orgId, orgId), eq(documents.id, poId)));
    revalidatePath("/purchases");
    return billId;
  } catch (e) {
    await db.update(documents).set({ status: po.status }).where(and(eq(documents.orgId, orgId), eq(documents.id, poId), eq(documents.status, "converting")));
    throw e;
  }
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
export async function convertPoToBill(poId: number, lineQtys?: Record<number, number>) {
  return withOrg(() => _convertPoToBill(poId, lineQtys));
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

/* ---------------- Client Portal ---------------- */

export async function updatePortalUserAction(contactId: number, email: string, password?: string) {
  return withOrg(async () => {
    // we need crypto to hash password
    const crypto = await import("crypto");
    const { portalUsers } = await import("@/db");
    const orgId = currentOrgId();
    
    const [existing] = await db.select().from(portalUsers)
      .where(and(eq(portalUsers.orgId, orgId), eq(portalUsers.contactId, contactId)))
      .limit(1);

    if (existing) {
      const updates: any = { email };
      if (password) {
        updates.passwordHash = crypto.createHash("sha256").update(password).digest("hex");
      }
      await db.update(portalUsers)
        .set(updates)
        .where(eq(portalUsers.id, existing.id));
    } else {
      if (!password) return { error: "Password is required for new users." };
      
      // Check email collision across the org
      const [emailClash] = await db.select().from(portalUsers)
        .where(and(eq(portalUsers.orgId, orgId), eq(portalUsers.email, email)))
        .limit(1);
      
      if (emailClash) return { error: "Email is already in use by another contact." };

      const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
      await db.insert(portalUsers).values({
        orgId,
        contactId,
        email,
        passwordHash,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath(`/contacts/${contactId}`);
    return { success: true };
  });
}

export async function saveArticleAction(id: number | null, title: string, content: string, published: boolean) {
  return withOrg(async () => {
    const { knowledgeArticles } = await import("@/db");
    const orgId = currentOrgId();
    
    if (id) {
      await db.update(knowledgeArticles)
        .set({ title, content, published })
        .where(and(eq(knowledgeArticles.orgId, orgId), eq(knowledgeArticles.id, id)));
    } else {
      await db.insert(knowledgeArticles).values({
        orgId,
        title,
        content,
        published,
        createdAt: new Date().toISOString(),
      });
    }

    revalidatePath("/settings/knowledge-base");
    return { success: true };
  });
}


/**
 * Invoices belonging to one customer, for the "rebilled on" picker on
 * expenses and bills. Loaded on demand rather than shipping every invoice in
 * the org to the client.
 */
export async function listCustomerInvoices(contactId: number) {
  return withOrg(async () => {
    if (!contactId) return [];
    const rows = await db
      .select({
        id: documents.id,
        number: documents.number,
        date: documents.date,
        totalCents: documents.totalCents,
        status: documents.status,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, currentOrgId()),
          eq(documents.contactId, contactId),
          eq(documents.type, "invoice"),
          eq(documents.isTemplate, false),
          ne(documents.status, "void")
        )
      )
      .orderBy(desc(documents.date))
      .limit(200);
    return rows;
  });
}
