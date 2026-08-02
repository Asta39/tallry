import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, itemGroups, items, org } from "@/db";
import { orgContext } from "../org";
import { saveItem } from "../actions";

const ORG = 33;

function inOrg<T>(fn: () => Promise<T>): Promise<T> {
  return orgContext.run(ORG, fn);
}

test("saveItem requires a group when item groups are enabled", async () => {
  const marker = `ITEM_GROUP_TEST_${Date.now()}`;
  const [beforeOrg] = await db
    .select({ itemGroupsEnabled: org.itemGroupsEnabled })
    .from(org)
    .where(eq(org.id, ORG))
    .limit(1);

  let groupId: number | null = null;
  let createdItemId: number | null = null;

  try {
    await db.update(org).set({ itemGroupsEnabled: true }).where(eq(org.id, ORG));
    const [group] = await db
      .insert(itemGroups)
      .values({ orgId: ORG, name: marker, createdAt: new Date().toISOString() })
      .returning({ id: itemGroups.id });
    groupId = group.id;

    await inOrg(async () => {
      await assert.rejects(
        saveItem({
          kind: "goods",
          name: `${marker}-missing`,
          unit: "pc",
          salePriceCents: 1000,
          purchaseCostCents: 500,
          taxClass: "B16",
          trackInventory: false,
          reorderLevel: 0,
        }),
        /pick an item group/i
      );

      createdItemId = await saveItem({
        kind: "goods",
        itemGroupId: groupId,
        name: `${marker}-ok`,
        unit: "pc",
        salePriceCents: 1000,
        purchaseCostCents: 500,
        taxClass: "B16",
        trackInventory: false,
        reorderLevel: 0,
      });
    });

    const [saved] = await db
      .select({ itemGroupId: items.itemGroupId })
      .from(items)
      .where(and(eq(items.orgId, ORG), eq(items.id, createdItemId!)))
      .limit(1);
    assert.equal(saved.itemGroupId, groupId);
  } finally {
    if (createdItemId) {
      await db.delete(items).where(and(eq(items.orgId, ORG), eq(items.id, createdItemId)));
    }
    if (groupId) {
      await db.delete(itemGroups).where(and(eq(itemGroups.orgId, ORG), eq(itemGroups.id, groupId)));
    }
    await db.update(org).set({ itemGroupsEnabled: beforeOrg?.itemGroupsEnabled ?? false }).where(eq(org.id, ORG));
  }
});
