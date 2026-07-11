import { db, payrollRuns } from "./src/db/index.js";
import { eq } from "drizzle-orm";

async function main() {
  await db.delete(payrollRuns).where(eq(payrollRuns.id, 1));
  console.log("Deleted Run 1");
}
main();
