import { db, statutoryRules } from "./src/db/index.js";

async function main() {
  const rules = await db.select().from(statutoryRules);
  console.log("RULES:", rules);
}
main();
