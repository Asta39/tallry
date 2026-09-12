"use server";

import { db, purchaseRequests } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/super-admin";

export async function setPurchaseRequestStatus(id: number, status: "pending" | "contacted" | "activated" | "cancelled") {
  await requireSuperAdmin();
  await db.update(purchaseRequests).set({ status }).where(eq(purchaseRequests.id, id));
  revalidatePath("/admin/purchase-requests");
  revalidatePath("/admin");
}

/** Hard delete — for test/junk submissions, not for real leads (use
 *  "cancelled" status for those so the record and its history stays). */
export async function deletePurchaseRequest(id: number) {
  await requireSuperAdmin();
  await db.delete(purchaseRequests).where(eq(purchaseRequests.id, id));
  revalidatePath("/admin/purchase-requests");
  revalidatePath("/admin");
}
