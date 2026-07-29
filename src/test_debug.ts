import { db, org, users } from "@/db";
import { getOrg } from "@/lib/org";
import { getAccess } from "@/lib/access";

async function main() {
  console.log("Checking DB connection...");
  const orgs = await db.select().from(org).limit(1);
  console.log("Orgs count:", orgs.length);
}

main().catch(console.error);
