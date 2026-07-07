import { fetchInitialData } from "./src/components/docData";
import { orgContext } from "./src/lib/org";
import { db, documents } from "./src/db";

async function main() {
  console.log("Running fetchInitialData...");
  try {
    const doc = await db.select().from(documents).limit(1);
    if (!doc[0]) {
      console.log("No documents found in DB!");
      return;
    }
    const docId = doc[0].id;
    const orgId = doc[0].orgId;
    console.log("Found doc:", docId, "for org:", orgId);
    
    orgContext.run(orgId, async () => {
      try {
        const data = await fetchInitialData(docId);
        console.log("Success fetching doc ID", docId);
      } catch (err) {
        console.error("fetchInitialData Error:", err);
      }
    });
  } catch (err) {
    console.error("Outer Error:", err);
  }
}
main();
