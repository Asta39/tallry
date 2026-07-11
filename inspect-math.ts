import { db, payrollRuns, payrollRunLineItems, accounts } from "./src/db/index.js";
import { eq, and } from "drizzle-orm";

async function main() {
  const [run] = await db.select().from(payrollRuns).orderBy(payrollRuns.id);
  if (!run) return console.log("No run");

  const lines = await db.select().from(payrollRunLineItems).where(eq(payrollRunLineItems.payrollRunId, run.id));

  let totalGross = 0;
  let totalNet = 0;
  let totalTax = 0;
  let totalLoans = 0;

  for (const line of lines) {
    if (line.type === "gross_pay") {
      totalGross += line.amountCents;
    } else if (line.type === "net_pay") {
      totalNet += line.amountCents;
    } else if (line.type === "deduction" && line.subType === "loan") {
      totalLoans += line.amountCents;
    } else if (line.type === "deduction" && line.subType !== "adjustment") {
      totalTax += line.amountCents;
    }
  }

  let arAccountId: number | null = null;
  if (totalLoans > 0) {
    const [ar] = await db.select().from(accounts).where(and(eq(accounts.orgId, run.orgId), eq(accounts.code, "1200")));
    if (!ar) {
      console.log("AR ACCOUNT NOT FOUND!");
    } else {
      arAccountId = ar.id;
    }
  }

  console.log("Gross:", totalGross);
  console.log("Net:", totalNet);
  console.log("Tax:", totalTax);
  console.log("Loans:", totalLoans);
  console.log("Debits:", totalGross);
  console.log("Credits:", totalNet + totalTax + totalLoans);
  console.log("Diff:", totalGross - (totalNet + totalTax + totalLoans));
  console.log("AR Account ID:", arAccountId);

}

main().catch(console.error).then(() => process.exit(0));
