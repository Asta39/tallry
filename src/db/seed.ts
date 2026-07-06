/* Seed: org profile, Kenyan chart of accounts, default bank accounts, demo data.
   Idempotent — safe to run repeatedly. Run db:push first. */
export {};

async function main() {
  const { db, org, accounts, bankAccounts, contacts, items } = await import("./index");
  const { SEED_ACCOUNTS } = await import("../lib/coa");
  const { nowISO } = await import("../lib/money");
  const { eq } = await import("drizzle-orm");

  // Org (single row, id=1)
  const existingOrg = await db.select().from(org);
  if (existingOrg.length === 0) {
    await db.insert(org).values({
      id: 1,
      name: "My Business Ltd",
      kraPin: "P051234567X",
      vatRegistered: true,
      address: "Nairobi, Kenya",
      cuSerial: "SIMCU0000000001",
    });
    console.log("✓ org created");
  }

  // Chart of accounts
  for (const a of SEED_ACCOUNTS) {
    const [existing] = await db.select().from(accounts).where(eq(accounts.code, a.code)).limit(1);
    if (!existing) {
      await db.insert(accounts).values({
        orgId: existingOrg[0].id, code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        isSystem: a.system ?? false,
      });
    }
  }
  console.log(`✓ chart of accounts (${SEED_ACCOUNTS.length} accounts)`);

  // Default money accounts
  if ((await db.select().from(bankAccounts)).length === 0) {
    const [bankCoa] = await db.select().from(accounts).where(eq(accounts.code, "1000")).limit(1);
    const [mpesaCoa] = await db.select().from(accounts).where(eq(accounts.code, "1010")).limit(1);
    const [cashCoa] = await db.select().from(accounts).where(eq(accounts.code, "1020")).limit(1);
    await db.insert(bankAccounts).values([
      { orgId: existingOrg[0].id, name: "Main Bank Account", kind: "bank", accountId: bankCoa.id },
      { orgId: existingOrg[0].id, name: "M-Pesa Till", kind: "mpesa", accountId: mpesaCoa.id },
      { orgId: existingOrg[0].id, name: "Petty Cash", kind: "cash", accountId: cashCoa.id },
    ]);
    console.log("✓ money accounts (bank, M-Pesa, cash)");
  }

  // A couple of starter records so the app isn't empty
  if ((await db.select().from(contacts)).length === 0) {
    await db.insert(contacts).values([
      {
        orgId: existingOrg[0].id, kind: "customer",
        displayName: "Acme Distributors Ltd",
        companyName: "Acme Distributors Ltd",
        email: "accounts@acme.co.ke",
        phone: "+254 722 000 111",
        kraPin: "P051111111A",
        city: "Nairobi",
        isWithholdingAgent: true,
        createdAt: nowISO(),
      },
      {
        orgId: existingOrg[0].id,
        kind: "vendor",
        displayName: "Safaricom PLC",
        companyName: "Simba Suppliers",
        email: "sales@simba.co.ke",
        phone: "+254 733 222 333",
        kraPin: "P052222222B",
        city: "Mombasa",
        createdAt: nowISO(),
      },
    ]);
    console.log("✓ sample contacts");
  }

  if ((await db.select().from(items)).length === 0) {
    const [sales] = await db.select().from(accounts).where(eq(accounts.code, "4000")).limit(1);
    await db.insert(items).values([
      {
        orgId: existingOrg[0].id,
        kind: "service",
        name: "Consulting Hours",
        unit: "hour",
        salePriceCents: 500_000,
        taxClass: "B16",
        salesAccountId: sales.id,
      },
      {
        orgId: existingOrg[0].id,
        kind: "goods",
        name: "Dell XPS 13",
        sku: "TS-001",
        unit: "pc",
        salePriceCents: 120_000,
        purchaseCostCents: 70_000,
        taxClass: "B16",
        salesAccountId: sales.id,
        trackInventory: true,
        reorderLevel: 10,
      },
    ]);
    console.log("✓ sample items");
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
