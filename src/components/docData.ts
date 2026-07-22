import { db, contacts, items, accounts, bankAccounts, members, documents, documentLines, documentAssignments, costCenters, warehouses } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { getOrg } from "@/lib/org";

/** Serialized option lists for the DocumentEditor (server → client). */
export async function editorOptions(side: "sale" | "purchase") {
  const org = await getOrg();
  const orgId = org.id;
  const wantedKinds = side === "sale" ? ["customer", "both"] : ["vendor", "both"];
  const contactRows = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.kind, wantedKinds)));
  const itemRows = await db.select().from(items).where(and(eq(items.orgId, orgId), eq(items.archived, false)));
  const expenseRows = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.type, "expense")));
  const bankRows = await db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, orgId), eq(bankAccounts.archived, false)));
  const memberRows = await db.select().from(members).where(and(eq(members.orgId, orgId), eq(members.active, true)));
  const costCenterRows = await db.select().from(costCenters).where(and(eq(costCenters.orgId, orgId), eq(costCenters.active, true)));
  const warehouseRows = await db.select().from(warehouses).where(and(eq(warehouses.orgId, orgId), eq(warehouses.archived, false)));

  return {
    customDocumentColumnName: org.customDocumentColumnName,
    members: memberRows.map((m) => ({ id: m.id, label: m.name || m.email })),
    contacts: contactRows.map((c) => ({ id: c.id, label: c.displayName })),
    items: itemRows.map((i) => ({
      id: i.id,
      name: i.name,
      salePriceCents: i.salePriceCents,
      purchaseCostCents: i.purchaseCostCents,
      taxClass: i.taxClass,
      unit: i.unit,
    })),
    expenseAccounts: expenseRows.map((a) => ({ id: a.id, label: a.name })),
    bankAccounts: bankRows.map((b) => ({ id: b.id, label: b.name })),
    costCenters: costCenterRows.map((c) => ({ id: c.id, label: c.code ? `${c.code} · ${c.name}` : c.name })),
    // Only surface a warehouse picker once an org actually has more than one —
    // single-location orgs never see this UI at all.
    warehouses: warehouseRows.length > 1 ? warehouseRows.map((w) => ({ id: w.id, label: w.name })) : [],
  };
}

export async function fetchInitialData(docId: number) {
  const org = await getOrg();
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, org.id), eq(documents.id, docId))).limit(1);
  if (!doc) throw new Error("Document not found");
  const lines = await db.select().from(documentLines).where(eq(documentLines.documentId, docId)).orderBy(documentLines.position);
  const assignments = await db.select().from(documentAssignments).where(eq(documentAssignments.documentId, docId));

  return {
    id: doc.id,
    status: doc.status,
    contactId: doc.contactId ?? "",
    date: doc.date,
    dueDate: doc.dueDate ?? "",
    taxInclusive: doc.taxInclusive,
    isTemplate: doc.isTemplate,
    notes: doc.notes ?? "",
    billNumber: ["bill", "expense"].includes(doc.type) ? doc.number : "",
    paidFrom: doc.paidFromBankAccountId ?? "",
    assignedMemberIds: assignments.map(a => a.memberId),
    lines: lines.map(l => ({
      itemId: l.itemId,
      description: l.description,
      qty: String(l.qty),
      price: (l.unitPriceCents / 100).toFixed(2),
      discountPct: String(l.discountPct),
      taxClass: l.taxClass as import("@/lib/tax").TaxClass,
      accountId: l.accountId,
      customColumnValue: l.customColumnValue ?? "",
      costCenterId: l.costCenterId,
      warehouseId: l.warehouseId,
    }))
  };
}
