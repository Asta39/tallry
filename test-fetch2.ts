import { db, documents, contacts, documentAssignments } from "./src/db";
import { and, desc, eq, exists, or, ilike, sql } from "drizzle-orm";

async function run() {
  const orgId = 1; // Assuming 1
  const today = new Date().toISOString().split('T')[0];
  const type = "quote";
  const isTemplate = false;

  const baseWhere = and(
    eq(documents.orgId, orgId),
    eq(documents.type, type),
    eq(documents.isTemplate, isTemplate),
  );

  const query = db
    .select({
      status: documents.status,
      overdue: sql<boolean>`${documents.status} = 'open' AND ${documents.dueDate} < ${today}`,
      total: sql<number>`sum(${documents.totalCents})`.mapWith(Number),
      paid: sql<number>`sum(${documents.paidCents})`.mapWith(Number),
    })
    .from(documents)
    .where(baseWhere)
    .groupBy(documents.status, documents.dueDate);
    
  console.log(query.toSQL());
}

run().catch(console.error).then(() => process.exit(0));
