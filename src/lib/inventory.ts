import { db, stockLots, warehouses } from "@/db";
import { currentOrgId } from "@/lib/org";
import { eq, and, gt, asc, sql } from "drizzle-orm";

/** The org's default warehouse — single-location orgs never need to think about warehouses at all. */
const defaultWarehouseCache = new Map<number, number>();
export async function defaultWarehouseId(): Promise<number> {
  const orgId = currentOrgId();
  const cached = defaultWarehouseCache.get(orgId);
  if (cached) return cached;
  const [row] = await db.select({ id: warehouses.id }).from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.isDefault, true))).limit(1);
  if (!row) throw new Error("No default warehouse configured for this organization");
  defaultWarehouseCache.set(orgId, row.id);
  return row.id;
}

/** Add a FIFO cost lot (from a bill, opening stock, or positive adjustment). */
export async function addLot(params: {
  itemId: number;
  date: string;
  qty: number;
  unitCostCents: number;
  sourceType: "bill" | "opening" | "adjustment" | "transfer";
  sourceId?: number;
  warehouseId?: number;
}) {
  await db.insert(stockLots).values({
    orgId: currentOrgId(),
    itemId: params.itemId,
    warehouseId: params.warehouseId ?? (await defaultWarehouseId()),
    date: params.date,
    qty: params.qty,
    remainingQty: params.qty,
    unitCostCents: params.unitCostCents,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
  });
}

/**
 * Consume `qty` from oldest lots first, within one warehouse. Returns the
 * FIFO cost consumed in cents. If stock runs out, the shortfall is costed at
 * the last known lot cost (or 0), mirroring Zoho's negative-stock behavior.
 */
export async function consumeFifo(itemId: number, qty: number, warehouseId?: number): Promise<number> {
  const wid = warehouseId ?? (await defaultWarehouseId());
  let remaining = qty;
  let cogs = 0;
  let lastCost = 0;

  const lots = await db
    .select()
    .from(stockLots)
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId), eq(stockLots.warehouseId, wid), gt(stockLots.remainingQty, 0)))
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

export async function stockOnHand(itemId: number, warehouseId?: number): Promise<number> {
  const conds = [eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId)];
  if (warehouseId) conds.push(eq(stockLots.warehouseId, warehouseId));
  const [row] = await db
    .select({ qty: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)` })
    .from(stockLots)
    .where(and(...conds));
  return Number(row?.qty ?? 0);
}

export async function stockValueCents(itemId: number, warehouseId?: number): Promise<number> {
  const conds = [eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId)];
  if (warehouseId) conds.push(eq(stockLots.warehouseId, warehouseId));
  const [row] = await db
    .select({
      v: sql<number>`coalesce(sum(${stockLots.remainingQty} * ${stockLots.unitCostCents}), 0)`,
    })
    .from(stockLots)
    .where(and(...conds));
  return Math.round(Number(row?.v ?? 0));
}

/** Per-warehouse on-hand qty for an item — for the items list / transfer picker. */
export async function stockByWarehouse(itemId: number) {
  const rows = await db
    .select({
      warehouseId: stockLots.warehouseId,
      warehouseName: warehouses.name,
      qty: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)`,
    })
    .from(stockLots)
    .innerJoin(warehouses, eq(stockLots.warehouseId, warehouses.id))
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.itemId, itemId)))
    .groupBy(stockLots.warehouseId, warehouses.name);
  return rows.map((r) => ({ warehouseId: r.warehouseId, warehouseName: r.warehouseName, qty: Number(r.qty) }));
}

/**
 * Move qty from one warehouse to another at a weighted-average cost (FIFO
 * consumption at the source can span multiple cost lots; the destination
 * gets one lot at the blended cost). No GL entry — inventory is the same
 * asset, just relocated.
 */
export async function transferStock(params: {
  itemId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  qty: number;
  date: string;
  note?: string;
}): Promise<{ unitCostCents: number }> {
  if (params.fromWarehouseId === params.toWarehouseId) throw new Error("Source and destination warehouses must differ");
  if (params.qty <= 0) throw new Error("Quantity must be greater than zero");

  const onHand = await stockOnHand(params.itemId, params.fromWarehouseId);
  if (params.qty > onHand) throw new Error(`Only ${onHand} available at the source warehouse`);

  const costCents = await consumeFifo(params.itemId, params.qty, params.fromWarehouseId);
  const unitCostCents = Math.round(costCents / params.qty);

  await addLot({
    itemId: params.itemId,
    date: params.date,
    qty: params.qty,
    unitCostCents,
    sourceType: "transfer",
    warehouseId: params.toWarehouseId,
  });

  const { stockTransfers } = await import("@/db");
  await db.insert(stockTransfers).values({
    orgId: currentOrgId(),
    itemId: params.itemId,
    fromWarehouseId: params.fromWarehouseId,
    toWarehouseId: params.toWarehouseId,
    qty: params.qty,
    unitCostCents,
    date: params.date,
    note: params.note || null,
    createdAt: new Date().toISOString(),
  });

  return { unitCostCents };
}
