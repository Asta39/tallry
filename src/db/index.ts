import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

/**
 * Supabase Postgres via the session pooler (IPv4-friendly).
 * DATABASE_URL comes from .env.local — Next.js loads it automatically;
 * for plain scripts (seed, smoke) we read the file ourselves.
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("DATABASE_URL not set — add it to .env.local");
}

declare global {
  // eslint-disable-next-line no-var
  var __biasharaPg: ReturnType<typeof createDb> | undefined;
}

function createDb() {
  const client = postgres(resolveDatabaseUrl(), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // required for Supabase transaction pooler (port 6543); harmless on 5432
  });
  return drizzle(client, { schema });
}

// Cache the client (and its connection pool) on the warm Lambda/Node process
// in every environment, not just dev. Skipping this in production meant every
// serverless invocation opened a brand-new pool of up to 10 Postgres
// connections instead of reusing the warm instance's — under any concurrent
// load (e.g. several Realtime-triggered refreshes landing close together)
// that churns through Supabase's connection ceiling fast, surfacing as
// random "Server Component render error" failures with no clear repro.
export const db = globalThis.__biasharaPg ?? createDb();
globalThis.__biasharaPg = db;

export * from "./schema";
