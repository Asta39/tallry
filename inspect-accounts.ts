import { db, accounts } from "./src/db/index.js";
import { eq } from "drizzle-orm";

async function main() {
  const all = await db.select().from(accounts);
  console.log("All accounts:", all.map(a => `${a.code} - ${a.name} (Org: ${a.orgId})`));
}
main().catch(console.error).then(() => process.exit(0));
