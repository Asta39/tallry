import { db, documents, contacts } from "./src/db";
import { eq, and, desc } from "drizzle-orm";

async function test() {
  const orgId = 1; // Assuming an org ID
  const type = "quote";
  
  const rows = await db
    .select({
      doc: documents,
      contactName: contacts.displayName,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(eq(documents.orgId, orgId), eq(documents.type, type)))
    .orderBy(desc(documents.date), desc(documents.id));
    
  console.log(rows);
}
test().catch(console.error);
