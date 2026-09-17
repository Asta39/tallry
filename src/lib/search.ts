import { db, contacts, documents, items, employees, documentAssignments } from "@/db";
import { ilike, or, eq, and, inArray } from "drizzle-orm";
import type { Access } from "@/lib/access";
import { canViewAllData } from "@/lib/access";
import { sectionForResultType, type SearchSection } from "@/lib/search-sections";

export interface SearchResult {
  type: string;
  title: string;
  subtitle: string;
  href: string;
  exactMatch: boolean;
  sectionMatch: boolean;
}

const DOC_LIST_HREF: Record<string, string> = {
  quote: "sales/quotes",
  invoice: "sales/invoices",
  credit_note: "sales/credit-notes",
  bill: "purchases/bills",
  purchase_order: "purchases/orders",
  expense: "purchases/expenses",
};

const NUMBERED_DOC_TYPES = new Set(Object.keys(DOC_LIST_HREF));

/** A purely numeric query matches a document's own trailing digits — so
 *  "343" finds "INV-0343" — otherwise an exact match is a full-string,
 *  case-insensitive equality against the result's own title. */
function isExactMatch(query: string, title: string, type: string): boolean {
  const q = query.trim().toLowerCase();
  const t = title.trim().toLowerCase();
  if (t === q) return true;
  if (/^\d+$/.test(q) && NUMBERED_DOC_TYPES.has(type)) {
    const suffix = t.match(/(\d+)$/)?.[1];
    if (suffix && parseInt(suffix, 10) === parseInt(q, 10)) return true;
  }
  return false;
}

/**
 * Core search logic, kept separate from the HTTP route (src/app/api/search/route.ts)
 * so it's directly callable/testable without going through auth+HTTP — same
 * reasoning as getUnresolvedFindings in ledger-integrity.ts. System-wide
 * always; `section` (the caller's current part of the app, from
 * sectionForPathname) only affects ranking, never what's included.
 */
export async function runSearch(access: Access, q: string, section: SearchSection): Promise<SearchResult[]> {
  const orgId = access.orgId;
  const like = `%${q}%`;

  const [matchedContacts, matchedDocs, matchedItems, matchedEmployees] = await Promise.all([
    db.select({ id: contacts.id, name: contacts.displayName, kind: contacts.kind })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), or(ilike(contacts.displayName, like), ilike(contacts.email, like))))
      .limit(6),
    db.select({ id: documents.id, number: documents.number, type: documents.type, contactName: contacts.displayName })
      .from(documents)
      .leftJoin(contacts, eq(documents.contactId, contacts.id))
      .where(and(eq(documents.orgId, orgId), or(ilike(documents.number, like), ilike(contacts.displayName, like))))
      .limit(10),
    db.select({ id: items.id, name: items.name, sku: items.sku })
      .from(items)
      .where(and(eq(items.orgId, orgId), eq(items.archived, false), or(ilike(items.name, like), ilike(items.sku, like))))
      .limit(6),
    db.select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), ilike(employees.name, like)))
      .limit(6),
  ]);

  // Same segregation rule every document list uses — an assigned-only role
  // only sees documents assigned to them.
  let finalDocs = matchedDocs;
  if (!canViewAllData(access) && finalDocs.length > 0) {
    const docIds = finalDocs.map((d) => d.id);
    const assignments = await db.select().from(documentAssignments).where(
      and(inArray(documentAssignments.documentId, docIds), eq(documentAssignments.memberId, access.memberId!))
    );
    const assignedIds = new Set(assignments.map((a) => a.documentId));
    finalDocs = finalDocs.filter((d) => assignedIds.has(d.id));
  }

  const results: SearchResult[] = [
    ...matchedContacts.map((c) => ({
      type: c.kind,
      title: c.name,
      subtitle: c.kind === "customer" ? "Customer" : "Vendor",
      href: `/contacts/${c.id}`,
    })),
    ...finalDocs.map((d) => ({
      type: d.type,
      title: d.number,
      subtitle: `${d.type.charAt(0).toUpperCase() + d.type.slice(1).replace("_", " ")} • ${d.contactName || "No contact"}`,
      href: `/${DOC_LIST_HREF[d.type] || "purchases/orders"}/${d.id}`,
    })),
    ...matchedItems.map((i) => ({
      type: "item",
      title: i.name,
      subtitle: i.sku ? `Item • ${i.sku}` : "Item",
      href: `/items/${i.id}`,
    })),
    ...matchedEmployees.map((e) => ({
      type: "employee",
      title: e.name,
      subtitle: "Employee",
      href: `/payroll/employees/${e.id}`,
    })),
  ].map((r) => ({
    ...r,
    exactMatch: isExactMatch(q, r.title, r.type),
    sectionMatch: sectionForResultType(r.type) === section,
  }));

  // Exact match always first (regardless of section), then results native
  // to the caller's current section, preserving each group's original
  // relevance order within itself.
  results.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
    if (a.sectionMatch !== b.sectionMatch) return a.sectionMatch ? -1 : 1;
    return 0;
  });

  return results.slice(0, 12);
}
