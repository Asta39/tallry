import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import { db, documents, org } from "@/db";
import { orgContext } from "../org";
import { saveDocument } from "../actions";

const ORG = 33;
const CONTACT_ID = 102;
const TODAY = new Date().toISOString().slice(0, 10);

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

test("saveDocument rolls back document writes when a late assignment insert fails", async () => {
  const marker = `TX_ROLLBACK_TEST_${Date.now()}`;

  const [beforeOrg] = await db
    .select({ nextInvoiceNo: org.nextInvoiceNo })
    .from(org)
    .where(eq(org.id, ORG))
    .limit(1);
  const [beforeDocs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.orgId, ORG), eq(documents.notes, marker)));

  await inOrg(async () => {
    await assert.rejects(
      saveDocument({
        type: "invoice",
        contactId: CONTACT_ID,
        date: TODAY,
        dueDate: TODAY,
        taxInclusive: false,
        notes: marker,
        assignedMemberIds: [999999999],
        lines: [
          {
            description: marker,
            qty: 1,
            unitPriceCents: 12_345,
            discountPct: 0,
            taxClass: "B16",
          },
        ],
      }),
      /foreign key|document_assignments|member_id/i
    );
  });

  const [afterOrg] = await db
    .select({ nextInvoiceNo: org.nextInvoiceNo })
    .from(org)
    .where(eq(org.id, ORG))
    .limit(1);
  const [afterDocs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.orgId, ORG), eq(documents.notes, marker)));

  assert.equal(afterOrg.nextInvoiceNo, beforeOrg.nextInvoiceNo);
  assert.equal(Number(afterDocs.count), Number(beforeDocs.count));
});
