"use server";

import { db, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { getClientSession } from "@/lib/client-portal/auth";
import { revalidatePath } from "next/cache";

export async function updatePortalProfileAction(
  slug: string,
  data: { phone: string; email: string; address: string; city: string }
) {
  const session = await getClientSession(slug);
  if (!session) return { error: "Not authenticated" };

  await db
    .update(contacts)
    .set({
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      address: data.address.trim() || null,
      city: data.city.trim() || null,
    })
    .where(and(eq(contacts.id, session.contactId), eq(contacts.orgId, session.orgId)));

  revalidatePath(`/portal/${slug}/profile`);
  return { success: true };
}
