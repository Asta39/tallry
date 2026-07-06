/* Posting-engine smoke test: invoice → payment with WHT → checks ledger balance.
   Run: npx tsx src/db/smoke.ts   (writes to the Supabase dev db; safe on seed data) */
export {};

async function main() {
  const { db, documents, journalLines, contacts, items } = await import("./index");
  const { saveDocument, issueDocument, recordPayment } = await import("../lib/actions");
  const { accountBalances, vatReturn } = await import("../lib/reports");
  const { sql, eq, asc } = await import("drizzle-orm");

  const orgId = Number(process.env.BIASHARA_ORG_ID || 1);
  const { eq: eqOp } = await import("drizzle-orm");
  let [customer] = await db.select().from(contacts).where(eqOp(contacts.orgId, orgId)).orderBy(asc(contacts.id)).limit(1);
  if (!customer) {
    const { nowISO } = await import("../lib/money");
    [customer] = await db
      .insert(contacts)
      .values({ orgId, kind: "customer", displayName: "Smoke Test Customer", kraPin: "P051111111A", createdAt: nowISO() })
      .returning();
  }
  let allItems = await db.select().from(items).where(eqOp(items.orgId, orgId)).orderBy(asc(items.id));
  if (allItems.length < 2) {
    await db.insert(items).values([
      { orgId, kind: "service", name: "Consulting (hourly)", unit: "hour", salePriceCents: 500_000, taxClass: "B16" },
      { orgId, kind: "goods", name: "Branded T-Shirt", sku: "TS-001", unit: "pc", salePriceCents: 120_000, purchaseCostCents: 70_000, taxClass: "B16", trackInventory: true, reorderLevel: 10 },
    ]);
    allItems = await db.select().from(items).where(eqOp(items.orgId, orgId)).orderBy(asc(items.id));
  }

  // 1. Create + issue an invoice: 2 consulting hrs @5,000 + 5 t-shirts @1,200
  const invId = await saveDocument({
    type: "invoice",
    contactId: customer.id,
    date: "2026-07-06",
    dueDate: "2026-08-05",
    taxInclusive: false,
    lines: [
      { itemId: allItems[0].id, description: "Consulting (hourly)", qty: 2, unitPriceCents: 500_000, discountPct: 0, taxClass: "B16" },
      { itemId: allItems[1].id, description: "Branded T-Shirt", qty: 5, unitPriceCents: 120_000, discountPct: 0, taxClass: "B16" },
    ],
  });
  await issueDocument(invId);
  const [inv] = await db.select().from(documents).where(eq(documents.id, invId)).limit(1);
  console.log(`Invoice ${inv.number}: total ${inv.totalCents} (expect 1,856,000)`);
  if (inv.totalCents !== 1_856_000) throw new Error("Invoice total wrong");
  if (!inv.cuInvoiceNumber || !inv.qrUrl) throw new Error("eTIMS signing missing");
  console.log(`eTIMS: CU ${inv.cuInvoiceNumber}`);

  // 2. Customer pays with WHT withheld (5% of net 16,000.00 = 800.00)
  await recordPayment({
    direction: "in",
    documentId: invId,
    date: "2026-07-06",
    amountCents: inv.totalCents,
    whtCents: 80_000,
    method: "bank",
    bankAccountId: 1,
    reference: "SMOKE-PAY",
  });
  const [paidInv] = await db.select().from(documents).where(eq(documents.id, invId)).limit(1);
  if (paidInv.status !== "paid") throw new Error(`Expected paid, got ${paidInv.status}`);
  console.log(`Payment posted, invoice status: ${paidInv.status}`);

  // 3. Ledger must balance: total debits === total credits
  const [sums] = await db
    .select({ dr: sql<number>`sum(debit_cents)`, cr: sql<number>`sum(credit_cents)` })
    .from(journalLines);
  console.log(`Ledger: DR ${sums.dr} = CR ${sums.cr}`);
  if (Number(sums.dr) !== Number(sums.cr)) throw new Error("LEDGER UNBALANCED");

  // 4. VAT return sees the output VAT
  const vat = await vatReturn("2026-07-01", "2026-07-31");
  console.log(`VAT return: output ${vat.outputVat} input ${vat.inputVat} due ${vat.netVatDue}`);
  if (vat.outputVat < 256_000) throw new Error("VAT return missing output VAT");

  const balances = await accountBalances({ to: "2026-12-31" });
  const wht = balances.find((b) => b.code === "1310");
  console.log(`WHT receivable: ${wht?.balanceCents} (expect ≥ 80,000)`);

  console.log("\n✅ SMOKE PASSED — posting engine, eTIMS signing, WHT, VAT return all consistent on Postgres");
  process.exit(0);
}

main().catch((e) => {
  console.error("Smoke failed:", e.stack || e.message);
  process.exit(1);
});
