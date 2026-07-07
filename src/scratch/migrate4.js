const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  try {
    const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`;
    console.log(res.map(r => r.table_name).join(', '));
  } catch(e) { console.error(e.message) }
  process.exit(0);
}
run();
