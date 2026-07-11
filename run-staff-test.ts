import { db, members } from "./src/db/index.js";
import { getAccess, MODULES, rolePermMap, getAllRoles } from "./src/lib/access.js";
import { eq } from "drizzle-orm";

async function main() {
  try {
    const orgId = 1; // mock orgId
    console.log("Fetching staff...");
    const staff = await db.select().from(members).where(eq(members.orgId, orgId));
    console.log("Fetching allRoles...");
    const allRoles = await getAllRoles(orgId);
    console.log("All roles:", allRoles);
    
    const editableRoles = allRoles.filter((r) => r !== "admin");
    console.log("Editable roles:", editableRoles);

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const r of editableRoles) {
      matrix[r] = await rolePermMap(orgId, r);
    }
    console.log("Matrix built successfully.");
    console.log("Success");
  } catch (err) {
    console.error("Error occurred:", err);
  }
}

main();
