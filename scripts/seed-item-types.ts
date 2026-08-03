import { db, org } from "../src/db";
import { ensureExpandedChartOfAccounts } from "../src/lib/org";

async function main() {
  const orgs = await db.select().from(org);
  for (const o of orgs) {
    await ensureExpandedChartOfAccounts(o.id);
  }
  console.log("Seeded item types for", orgs.length, "orgs");
  process.exit(0);
}
main();
