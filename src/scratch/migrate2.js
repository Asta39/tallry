const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    await sql`ALTER TABLE "document_lines" ADD COLUMN IF NOT EXISTS "custom_column_value" text;`;
    console.log('Added custom_column_value');
  } catch(e) { console.error(e.message) }
  process.exit(0);
}
run();
