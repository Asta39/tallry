const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  try {
    const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';`;
    console.log(res.map(r => r.column_name).join(', '));
  } catch(e) { console.error(e.message) }
  process.exit(0);
}
run();
