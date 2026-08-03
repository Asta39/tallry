import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, org, warehouses } from "@/db";
import { defaultWarehouseId } from "../inventory";
import { orgContext } from "../org";

function inOrg<T>(orgId: number, fn: () => Promise<T>): Promise<T> {
  return orgContext.run(orgId, fn);
}

test("defaultWarehouseId falls back to the sole active warehouse", async () => {
  const marker = `INVENTORY_DEFAULT_${Date.now()}`;
  let orgId: number | null = null;
  let warehouseId: number | null = null;

  try {
    const [createdOrg] = await db
      .insert(org)
      .values({
        name: marker,
        userId: `${marker}@example.test`,
      })
      .returning({ id: org.id });
    orgId = createdOrg.id;

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        orgId,
        name: `${marker}-warehouse`,
        isDefault: false,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: warehouses.id });
    warehouseId = warehouse.id;

    const resolved = await inOrg(orgId, () => defaultWarehouseId());
    assert.equal(resolved, warehouseId);
  } finally {
    if (warehouseId) {
      await db.delete(warehouses).where(and(eq(warehouses.orgId, orgId!), eq(warehouses.id, warehouseId)));
    }
    if (orgId) {
      await db.delete(org).where(eq(org.id, orgId));
    }
  }
});
