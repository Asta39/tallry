"use server";

import { db, contacts, items } from "@/db";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath as nextRevalidatePath } from "next/cache";

/** revalidatePath, but safe when called outside a Next request (scripts, tests). */
function revalidatePath(path: string) {
  try {
    nextRevalidatePath(path);
  } catch {
    /* outside request context */
  }
}
import { withOrg, currentOrgId } from "./org";
import { nowISO, todayISO } from "./money";
import { saveDocument, type DocLineInput } from "./actions";
import type { TaxClass } from "./tax";

/**
 * Bulk CSV imports. Row shapes match the template CSVs served by
 * /api/csv-template — parsing/validation happens client-side in CsvImporter,
 * these actions receive typed rows and write them org-scoped.
 */

const VALID_TAX = ["B16", "C0", "A_EXEMPT", "D_NONVAT"];

export interface ContactRow {
  kind: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  kraPin?: string;
  address?: string;
  city?: string;
}

export async function importContacts(rows: ContactRow[]): Promise<{ created: number; skipped: number }> {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const existing = await db.select({ name: contacts.displayName }).from(contacts).where(eq(contacts.orgId, orgId));
    const known = new Set(existing.map((e) => e.name.toLowerCase().trim()));
    let created = 0, skipped = 0;
    for (const r of rows) {
      const name = (r.displayName || "").trim();
      if (!name || known.has(name.toLowerCase())) { skipped++; continue; }
      await db.insert(contacts).values({
        orgId,
        kind: ["customer", "vendor", "both"].includes(r.kind) ? r.kind : "customer",
        displayName: name,
        companyName: r.companyName || null,
        email: r.email || null,
        phone: r.phone || null,
        kraPin: r.kraPin || null,
        address: r.address || null,
        city: r.city || null,
        createdAt: nowISO(),
      });
      known.add(name.toLowerCase());
      created++;
    }
    revalidatePath("/contacts");
    return { created, skipped };
  });
}

export interface ItemRow {
  kind: string;
  name: string;
  sku?: string;
  unit?: string;
  salePriceCents: number;
  purchaseCostCents: number;
  taxClass: string;
  trackInventory: boolean;
  reorderLevel: number;
}

export async function importItems(rows: ItemRow[]): Promise<{ created: number; skipped: number }> {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const existing = await db.select({ name: items.name }).from(items).where(eq(items.orgId, orgId));
    const known = new Set(existing.map((e) => e.name.toLowerCase().trim()));
    let created = 0, skipped = 0;
    for (const r of rows) {
      const name = (r.name || "").trim();
      if (!name || known.has(name.toLowerCase())) { skipped++; continue; }
      await db.insert(items).values({
        orgId,
        kind: r.kind === "goods" ? "goods" : "service",
        name,
        sku: r.sku || null,
        unit: r.unit || "unit",
        salePriceCents: Math.max(0, Math.round(r.salePriceCents)),
        purchaseCostCents: Math.max(0, Math.round(r.purchaseCostCents)),
        taxClass: VALID_TAX.includes(r.taxClass) ? r.taxClass : "B16",
        trackInventory: !!r.trackInventory,
        reorderLevel: Number(r.reorderLevel) || 0,
      });
      known.add(name.toLowerCase());
      created++;
    }
    revalidatePath("/items");
    return { created, skipped };
  });
}

export interface InvoiceRow {
  invoiceRef: string; // groups lines into one invoice
  customerName: string;
  date?: string;
  dueDate?: string;
  description: string;
  qty: number;
  unitPriceCents: number;
  discountPct: number;
  taxClass: string;
}

/**
 * Imports invoices as DRAFTS (grouped by invoiceRef). Customers matched by
 * name, created if missing. Review + issue each draft to post it (and get
 * its eTIMS signature) — imports never silently hit the ledger.
 */
export async function importInvoices(rows: InvoiceRow[]): Promise<{ created: number; skipped: number }> {
  return withOrg(async () => {
    const orgId = currentOrgId();
    const groups = new Map<string, InvoiceRow[]>();
    for (const r of rows) {
      const key = (r.invoiceRef || "").trim() || `row-${groups.size}`;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    const contactRows = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), inArray(contacts.kind, ["customer", "both"])));
    const byName = new Map(contactRows.map((c) => [c.displayName.toLowerCase().trim(), c.id]));

    let created = 0, skipped = 0;
    for (const [, lines] of groups) {
      const head = lines[0];
      const custName = (head.customerName || "").trim();
      if (!custName || lines.every((l) => !l.description)) { skipped++; continue; }

      let contactId = byName.get(custName.toLowerCase());
      if (!contactId) {
        const [c] = await db
          .insert(contacts)
          .values({ orgId, kind: "customer", displayName: custName, createdAt: nowISO() })
          .returning();
        contactId = c.id;
        byName.set(custName.toLowerCase(), c.id);
      }

      const docLines: DocLineInput[] = lines
        .filter((l) => l.description)
        .map((l) => ({
          description: l.description,
          qty: Number(l.qty) || 1,
          unitPriceCents: Math.max(0, Math.round(l.unitPriceCents)),
          discountPct: Number(l.discountPct) || 0,
          taxClass: (VALID_TAX.includes(l.taxClass) ? l.taxClass : "B16") as TaxClass,
        }));
      if (docLines.length === 0) { skipped++; continue; }

      await saveDocument({
        type: "invoice",
        contactId,
        date: head.date || todayISO(),
        dueDate: head.dueDate || null,
        taxInclusive: false,
        notes: undefined,
        lines: docLines,
      });
      created++;
    }
    revalidatePath("/sales/invoices");
    return { created, skipped };
  });
}
