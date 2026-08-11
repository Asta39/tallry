import { db, stockLots, warehouses, items, itemBoms } from "@/db";
import { currentOrgId } from "@/lib/org";
import { eq, and, gt, asc, sql, inArray } from "drizzle-orm";

/** The org's default warehouse — single-location orgs never need to think about warehouses at all. */
const defaultWarehouseCache = new Map<number, number>();
export async function defaultWarehouseId(): Promise<number> {
  const orgId = currentOrgId();
  const cached = defaultWarehouseCache.get(orgId);
  if (cached) return cached;
  const [row] = await db.select({ id: warehouses.id }).from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.isDefault, true))).limit(1);
  if (row) {
    defaultWarehouseCache.set(orgId, row.id);
    return row.id;
  }

  const activeWarehouses = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.orgId, orgId), eq(warehouses.archived, false)))
    .limit(2);
  if (activeWarehouses.length === 1) {
    defaultWarehouseCache.set(orgId, activeWarehouses[0].id);
    return activeWarehouses[0].id;
  }

  throw new Error("No default warehouse configured for this organization");
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
 *
 * Runs inside a transaction with row-level locks (`SELECT ... FOR UPDATE`) and
 * an atomic SQL decrement, so two concurrent sales of the same item/warehouse
 * can't both read the same remainingQty and both "consume" it — without this,
 * two simultaneous sales from a 5-unit lot could both succeed and take it to
 * -1 instead of one of them correctly falling through to the next lot (or
 * tolerated negative-stock shortfall).
 */
export async function consumeFifo(itemId: number, qty: number, warehouseId?: number): Promise<number> {
  const wid = warehouseId ?? (await defaultWarehouseId());
  const orgId = currentOrgId();

  return db.transaction(async (tx) => {
    let remaining = qty;
    let cogs = 0;
    let lastCost = 0;

    const lots = await tx
      .select()
      .from(stockLots)
      .where(and(eq(stockLots.orgId, orgId), eq(stockLots.itemId, itemId), eq(stockLots.warehouseId, wid), gt(stockLots.remainingQty, 0)))
      .orderBy(asc(stockLots.date), asc(stockLots.id))
      .for("update");

    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.remainingQty, remaining);
      cogs += Math.round(take * lot.unitCostCents);
      lastCost = lot.unitCostCents;
      remaining -= take;
      await tx
        .update(stockLots)
        .set({ remainingQty: sql`${stockLots.remainingQty} - ${take}` })
        .where(and(eq(stockLots.orgId, orgId), eq(stockLots.id, lot.id)));
    }
    if (remaining > 0) cogs += Math.round(remaining * lastCost);
    return cogs;
  });
}

export interface BomComponentConsumption {
  componentItemId: number;
  usedQty: number;
  usedCostCents: number;
  wasteQty: number;
  wasteCostCents: number;
}

export interface SaleConsumption {
  /** Cost of the actual product sold — COGS. Excludes waste. */
  cogsCents: number;
  /** Unusable offcut/scrap consumed alongside it — posted separately. */
  wasteCents: number;
  /** Null when this was a plain (non-kit) item — reversal restores the item's
   *  own stock directly. Set when a kit's components were consumed instead —
   *  reversal must restore each component individually. */
  bomBreakdown: BomComponentConsumption[] | null;
}

/**
 * Sells `qty` of an item. If it has Bill of Materials rows (a "kit"), consumes
 * each component's own FIFO stock (qty × recipe qty, plus qty × waste qty as
 * a separate consumption) instead of the kit item's own stock — it has none.
 * Otherwise behaves exactly like a plain consumeFifo call. Two separate
 * consumeFifo calls per component (used, then waste) rather than one
 * combined call + a proportional cost split — this way each portion gets its
 * own correct FIFO-ordered cost instead of an averaged approximation, and
 * physically consumes the same lots in the same order either way.
 */
export async function consumeForSale(itemId: number, qty: number, warehouseId?: number): Promise<SaleConsumption> {
  const orgId = currentOrgId();
  const bomRows = await db.select().from(itemBoms).where(and(eq(itemBoms.orgId, orgId), eq(itemBoms.parentItemId, itemId)));

  if (bomRows.length === 0) {
    const cogsCents = await consumeFifo(itemId, qty, warehouseId);
    return { cogsCents, wasteCents: 0, bomBreakdown: null };
  }

  let cogsCents = 0;
  let wasteCents = 0;
  const bomBreakdown: BomComponentConsumption[] = [];
  for (const row of bomRows) {
    const usedQty = qty * row.qtyPerUnit;
    const wasteQty = qty * row.wasteQtyPerUnit;
    const usedCostCents = usedQty > 0 ? await consumeFifo(row.componentItemId, usedQty, warehouseId) : 0;
    const wasteCostCents = wasteQty > 0 ? await consumeFifo(row.componentItemId, wasteQty, warehouseId) : 0;
    cogsCents += usedCostCents;
    wasteCents += wasteCostCents;
    bomBreakdown.push({ componentItemId: row.componentItemId, usedQty, usedCostCents, wasteQty, wasteCostCents });
  }
  return { cogsCents, wasteCents, bomBreakdown };
}

/** Reverses a consumeForSale() call — restores whatever stock it consumed,
 *  at the exact cost it was consumed at, whether that was the item's own
 *  stock or (for a kit) each component's. */
export async function restoreSaleConsumption(itemId: number, qty: number, date: string, sourceId: number, warehouseId: number | undefined, bomBreakdown: BomComponentConsumption[] | null, plainCostCents: number) {
  if (!bomBreakdown) {
    if (qty > 0) {
      await addLot({ itemId, date, qty, unitCostCents: Math.round(plainCostCents / qty), sourceType: "adjustment", sourceId, warehouseId });
    }
    return;
  }
  for (const c of bomBreakdown) {
    if (c.usedQty > 0) {
      await addLot({ itemId: c.componentItemId, date, qty: c.usedQty, unitCostCents: Math.round(c.usedCostCents / c.usedQty), sourceType: "adjustment", sourceId, warehouseId });
    }
    if (c.wasteQty > 0) {
      await addLot({ itemId: c.componentItemId, date, qty: c.wasteQty, unitCostCents: Math.round(c.wasteCostCents / c.wasteQty), sourceType: "adjustment", sourceId, warehouseId });
    }
  }
}

/** Expands a set of {itemId, qty} sale lines into total required qty per
 *  tracked-inventory item (kits expanded into their components, plain
 *  tracked items counted directly), then checks each against real stock on
 *  hand. Used to refuse a sale up front — before any FIFO consumption
 *  actually runs — when the org has blockInsufficientStock on. */
export async function checkStockAvailability(
  saleLines: { itemId: number; qty: number; warehouseId?: number }[]
): Promise<{ itemId: number; itemName: string; requiredQty: number; availableQty: number }[]> {
  const orgId = currentOrgId();
  const itemIds = [...new Set(saleLines.map((l) => l.itemId))];
  if (itemIds.length === 0) return [];

  const bomRows = await db.select().from(itemBoms).where(and(eq(itemBoms.orgId, orgId), inArray(itemBoms.parentItemId, itemIds)));
  const bomByParent = new Map<number, typeof bomRows>();
  for (const row of bomRows) {
    if (!bomByParent.has(row.parentItemId)) bomByParent.set(row.parentItemId, []);
    bomByParent.get(row.parentItemId)!.push(row);
  }
  const itemRows = await db.select({ id: items.id, trackInventory: items.trackInventory }).from(items).where(and(eq(items.orgId, orgId), inArray(items.id, itemIds)));
  const trackedById = new Map(itemRows.map((r) => [r.id, r.trackInventory]));

  // required[warehouseId][itemId] = qty
  const required = new Map<number, Map<number, number>>();
  const wid = await defaultWarehouseId();
  for (const l of saleLines) {
    const w = l.warehouseId ?? wid;
    const bom = bomByParent.get(l.itemId);
    if (bom && bom.length > 0) {
      for (const row of bom) {
        const need = l.qty * (row.qtyPerUnit + row.wasteQtyPerUnit);
        if (need <= 0) continue;
        if (!required.has(w)) required.set(w, new Map());
        const m = required.get(w)!;
        m.set(row.componentItemId, (m.get(row.componentItemId) ?? 0) + need);
      }
    } else if (trackedById.get(l.itemId)) {
      if (!required.has(w)) required.set(w, new Map());
      const m = required.get(w)!;
      m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.qty);
    }
  }

  const shortfalls: { itemId: number; itemName: string; requiredQty: number; availableQty: number }[] = [];
  for (const [w, m] of required.entries()) {
    for (const [checkItemId, requiredQty] of m.entries()) {
      const available = await stockOnHand(checkItemId, w);
      if (available < requiredQty - 1e-9) {
        const [item] = await db.select({ name: items.name }).from(items).where(and(eq(items.orgId, orgId), eq(items.id, checkItemId))).limit(1);
        shortfalls.push({ itemId: checkItemId, itemName: item?.name ?? `Item #${checkItemId}`, requiredQty, availableQty: available });
      }
    }
  }
  return shortfalls;
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

/** All items with on-hand stock in a given warehouse — for the warehouse detail page. */
export async function itemsInWarehouse(warehouseId: number) {
  const rows = await db
    .select({
      itemId: stockLots.itemId,
      name: items.name,
      sku: items.sku,
      unit: items.unit,
      qty: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)`,
      value: sql<number>`coalesce(sum(${stockLots.remainingQty} * ${stockLots.unitCostCents}), 0)`,
    })
    .from(stockLots)
    .innerJoin(items, eq(stockLots.itemId, items.id))
    .where(and(eq(stockLots.orgId, currentOrgId()), eq(stockLots.warehouseId, warehouseId)))
    .groupBy(stockLots.itemId, items.name, items.sku, items.unit)
    .having(sql`coalesce(sum(${stockLots.remainingQty}), 0) > 0`)
    .orderBy(asc(items.name));
  return rows.map((r) => ({ itemId: r.itemId, name: r.name, sku: r.sku, unit: r.unit, qty: Number(r.qty), valueCents: Math.round(Number(r.value)) }));
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
