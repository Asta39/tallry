import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, costCenters, documentLines, documents, items, warehouses } from "@/db";
import { orgContext } from "../org";
import { convertQuoteToInvoice, issueDocument, saveDocument } from "../actions";

const ORG = 33;
const CONTACT_ID = 102;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

test("convertQuoteToInvoice preserves line warehouse and cost center metadata", async () => {
  const marker = `QUOTE_CONVERT_TEST_${Date.now()}`;
  let itemId: number | null = null;
  let warehouseId: number | null = null;
  let costCenterId: number | null = null;
  let quoteId: number | null = null;
  let invoiceId: number | null = null;

  try {
    const [warehouse] = await db
      .insert(warehouses)
      .values({ orgId: ORG, name: `${marker}-warehouse`, isDefault: false, createdAt: new Date().toISOString() })
      .returning({ id: warehouses.id });
    warehouseId = warehouse.id;

    const [costCenter] = await db
      .insert(costCenters)
      .values({ orgId: ORG, name: `${marker}-cc`, code: marker.slice(-6), createdAt: new Date().toISOString() })
      .returning({ id: costCenters.id });
    costCenterId = costCenter.id;

    const [item] = await db
      .insert(items)
      .values({
        orgId: ORG,
        kind: "goods",
        name: `${marker}-item`,
        unit: "pc",
        salePriceCents: 1500,
        purchaseCostCents: 900,
        taxClass: "B16",
        trackInventory: true,
        reorderLevel: 0,
      })
      .returning({ id: items.id });
    itemId = item.id;

    await inOrg(async () => {
      quoteId = await saveDocument({
        type: "quote",
        contactId: CONTACT_ID,
        date: TODAY,
        dueDate: TODAY,
        taxInclusive: false,
        notes: marker,
        lines: [
          {
            itemId,
            description: `${marker}-line`,
            qty: 2,
            unitPriceCents: 1500,
            discountPct: 0,
            taxClass: "B16",
            costCenterId,
            warehouseId,
          },
        ],
      });

      await issueDocument(quoteId);
      invoiceId = await convertQuoteToInvoice(quoteId);
    });

    const [invoiceLine] = await db
      .select({
        warehouseId: documentLines.warehouseId,
        costCenterId: documentLines.costCenterId,
      })
      .from(documentLines)
      .where(and(eq(documentLines.orgId, ORG), eq(documentLines.documentId, invoiceId!)))
      .limit(1);

    assert.equal(invoiceLine.warehouseId, warehouseId);
    assert.equal(invoiceLine.costCenterId, costCenterId);
  } finally {
    if (invoiceId) {
      await db.delete(documentLines).where(and(eq(documentLines.orgId, ORG), eq(documentLines.documentId, invoiceId)));
      await db.delete(documents).where(and(eq(documents.orgId, ORG), eq(documents.id, invoiceId)));
    }
    if (quoteId) {
      await db.delete(documentLines).where(and(eq(documentLines.orgId, ORG), eq(documentLines.documentId, quoteId)));
      await db.delete(documents).where(and(eq(documents.orgId, ORG), eq(documents.id, quoteId)));
    }
    if (itemId) {
      await db.delete(items).where(and(eq(items.orgId, ORG), eq(items.id, itemId)));
    }
    if (costCenterId) {
      await db.delete(costCenters).where(and(eq(costCenters.orgId, ORG), eq(costCenters.id, costCenterId)));
    }
    if (warehouseId) {
      await db.delete(warehouses).where(and(eq(warehouses.orgId, ORG), eq(warehouses.id, warehouseId)));
    }
  }
});
