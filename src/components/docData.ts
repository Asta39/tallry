import { db, contacts, items, accounts, bankAccounts } from "@/db";
import { eq, inArray } from "drizzle-orm";

/** Serialized option lists for the DocumentEditor (server → client). */
export async function editorOptions(side: "sale" | "purchase") {
  const wantedKinds = side === "sale" ? ["customer", "both"] : ["vendor", "both"];
  const contactRows = await db.select().from(contacts).where(inArray(contacts.kind, wantedKinds));
  const itemRows = await db.select().from(items).where(eq(items.archived, false));
  const expenseRows = await db.select().from(accounts).where(eq(accounts.type, "expense"));
  const bankRows = await db.select().from(bankAccounts).where(eq(bankAccounts.archived, false));

  return {
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
  };
}
