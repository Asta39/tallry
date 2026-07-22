process.env.BIASHARA_ORG_ID = "1";
import { orgContext } from "@/lib/org";
import { db, org } from "@/db";
import { eq } from "drizzle-orm";
import * as A from "@/lib/analytics";

async function run(name: string, fn: () => Promise<any>) {
  try {
    const r = await fn();
    console.log(`OK ${name}:`, JSON.stringify(r).slice(0, 300));
  } catch (e: any) {
    console.log(`FAIL ${name}:`, e.message);
  }
}

async function main() {
  await orgContext.run(1, async () => {
    const [o] = await db.select().from(org).where(eq(org.id, 1)).limit(1);
    await run("revenueTrend", () => A.revenueTrend(3));
    await run("topCustomers", () => A.topCustomers(5));
    await run("topItems", () => A.topItems(5));
    await run("quoteConversion", () => A.quoteConversion(3));
    await run("cashFlowTrend", () => A.cashFlowTrend(3));
    await run("dso", () => A.dso());
    await run("bankBalanceTrend", () => A.bankBalanceTrend(3));
    await run("expenseBreakdown", () => A.expenseBreakdown(3));
    await run("topVendors", () => A.topVendors(5));
    await run("expenseClaimsStats", () => A.expenseClaimsStats());
    await run("marginTrend", () => A.marginTrend(3));
    await run("profitabilityByCustomer", () => A.profitabilityByCustomer(5));
    await run("stockValueByItem", () => A.stockValueByItem(5));
    await run("fastSlowMovers", () => A.fastSlowMovers(5));
    await run("deadStock", () => A.deadStock(60, 5));
    await run("payrollCostTrend", () => A.payrollCostTrend(3));
    await run("newHiresTrend", () => A.newHiresTrend(3));
    await run("timeTrackingHours", () => A.timeTrackingHours(8));
    await run("pipelineByStage", () => A.pipelineByStage());
    await run("newVsReturningCustomers", () => A.newVsReturningCustomers(3));
    await run("vatPositionTrend", () => A.vatPositionTrend(3));
    await run("booksHealth", () => A.booksHealth(o.lockDate));
  });
  process.exit(0);
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
