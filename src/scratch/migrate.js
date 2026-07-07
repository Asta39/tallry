const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    await sql`ALTER TABLE "org" ADD COLUMN IF NOT EXISTS "document_footer_text" text;`;
    console.log('Added document_footer_text');
  } catch(e) { console.error(e.message) }

  process.exit(0);
}
run();
