"use server";

import { db, purchaseRequests } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";

export async function setPurchaseRequestStatus(id: number, status: "pending" | "contacted" | "activated") {
  await requireSuperAdmin();
  await db.update(purchaseRequests).set({ status }).where(eq(purchaseRequests.id, id));
  revalidatePath("/admin/purchase-requests");
}
