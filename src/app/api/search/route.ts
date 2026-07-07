import { NextResponse } from "next/server";
import { db, contacts, documents } from "@/db";
import { ilike, or, eq, and } from "drizzle-orm";
import { getAccess } from "@/lib/access";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const access = await getAccess();
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const orgId = access.orgId;

    const [matchedContacts, matchedDocs] = await Promise.all([
      db
        .select({ id: contacts.id, name: contacts.displayName, kind: contacts.kind })
        .from(contacts)
        .where(
          and(
            eq(contacts.orgId, orgId),
            or(ilike(contacts.displayName, `%${q}%`), ilike(contacts.email, `%${q}%`))
          )
        )
        .limit(5),
      db
        .select({ id: documents.id, number: documents.number, type: documents.type, contactName: contacts.displayName })
        .from(documents)
        .leftJoin(contacts, eq(documents.contactId, contacts.id))
        .where(
          and(
            eq(documents.orgId, orgId),
            or(ilike(documents.number, `%${q}%`), ilike(contacts.displayName, `%${q}%`))
          )
        )
        .limit(5),
    ]);

    // Data Segregation: To be perfectly secure, we should ideally filter the documents by assignments if canViewAllData is false.
    // However, since it's just a search API, we can either filter them here or filter them after. Let's filter them if needed.
    let finalDocs = matchedDocs;
    if (access && !access.isOwner && access.role !== "admin" && access.orgRow.dataSegregation) {
       // Just fetch assignments for these matched docs
       if (finalDocs.length > 0) {
         const { documentAssignments } = await import("@/db");
         const { inArray } = await import("drizzle-orm");
         const docIds = finalDocs.map(d => d.id);
         const assignments = await db.select().from(documentAssignments).where(
           and(
             inArray(documentAssignments.documentId, docIds),
             eq(documentAssignments.memberId, access.memberId!)
           )
         );
         const assignedIds = new Set(assignments.map(a => a.documentId));
         finalDocs = finalDocs.filter(d => assignedIds.has(d.id));
       }
    }

    const results = [
      ...matchedContacts.map(c => ({
        type: c.kind, // "customer" | "vendor"
        title: c.name,
        subtitle: c.kind === "customer" ? "Customer" : "Vendor",
        href: `/contacts/${c.id}`
      })),
      ...finalDocs.map(d => ({
        type: d.type, // "invoice", "quote", etc.
        title: d.number,
        subtitle: `${d.type.charAt(0).toUpperCase() + d.type.slice(1)} • ${d.contactName || "No contact"}`,
        href: `/${d.type === "quote" ? "sales/quotes" : d.type === "invoice" ? "sales/invoices" : d.type === "bill" ? "purchases/bills" : d.type === "expense" ? "purchases/expenses" : d.type === "credit_note" ? "sales/credit-notes" : "purchases/orders"}/${d.id}`
      }))
    ];

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
