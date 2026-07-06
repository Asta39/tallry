/* Applies src/db/migration.sql to the Supabase Postgres database.
   Run: npm run db:push */
import fs from "fs";
import path from "path";

async function main() {
  const { db } = await import("./index");
  const { sql } = await import("drizzle-orm");
  const ddl = fs.readFileSync(path.join(process.cwd(), "src/db/migration.sql"), "utf8");
  await db.execute(sql.raw(ddl));
  console.log("✓ schema applied to Supabase");
  process.exit(0);
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
