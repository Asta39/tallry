import { db, stockLots } from "@/db";
import { currentOrgId } from "@/lib/org";
import { eq, and, gt, asc, sql } from "drizzle-orm";

/** Add a FIFO cost lot (from a bill, opening stock, or positive adjustment). */
export async function addLot(params: {
  itemId: number;
  date: string;
  qty: number;
  unitCostCents: number;
  sourceType: "bill" | "opening" | "adjustment";
  sourceId?: number;
}) {
  await db.insert(stockLots).values({
    orgId: currentOrgId(),
    itemId: params.itemId,
    date: params.date,
    qty: params.qty,
    remainingQty: params.qty,
    unitCostCents: params.unitCostCents,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
  });
}

/**
 * Consume `qty` from oldest lots first. Returns the FIFO cost consumed in cents.
 * If stock runs out, the shortfall is costed at the last known lot cost (or 0),
 * mirroring Zoho's negative-stock behavior.
 */
export async function consumeFifo(itemId: number, qty: number): Promise<number> {
  let remaining = qty;
  let cogs = 0;
  let lastCost = 0;

  const lots = await db
    .select()
    .from(stockLots)
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId), gt(stockLots.remainingQty, 0)))
    .orderBy(asc(stockLots.date), asc(stockLots.id));

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.remainingQty, remaining);
    cogs += Math.round(take * lot.unitCostCents);
    lastCost = lot.unitCostCents;
    remaining -= take;
    await db
      .update(stockLots)
      .set({ remainingQty: lot.remainingQty - take })
      .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.id, lot.id)));
  }
  if (remaining > 0) cogs += Math.round(remaining * lastCost);
  return cogs;
}

export async function stockOnHand(itemId: number): Promise<number> {
  const [row] = await db
    .select({ qty: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)` })
    .from(stockLots)
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId)));
  return Number(row?.qty ?? 0);
}

export async function stockValueCents(itemId: number): Promise<number> {
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${stockLots.remainingQty} * ${stockLots.unitCostCents}), 0)`,
    })
    .from(stockLots)
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId)));
  return Math.round(Number(row?.v ?? 0));
}
