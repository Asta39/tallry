"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getOrgBySlug, requestPortalOtp, verifyPortalOtp } from "@/lib/portal";

export async function portalRequestOtpAction(slug: string, phone: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return { error: "Business not found" };
  return requestPortalOtp(o.id, phone);
}

export async function portalVerifyOtpAction(slug: string, phone: string, code: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return { error: "Business not found" };

  const res = await verifyPortalOtp(o.id, phone, code);
  if (res.error || !res.token) return { error: res.error || "Verification failed" };

  const jar = await cookies();
  jar.set(`portal_${o.id}`, res.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 3600,
    path: `/p/${slug}`,
  });
  revalidatePath(`/p/${slug}`);
  return { ok: true };
}

export async function portalLogoutAction(slug: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return;
  const jar = await cookies();
  jar.delete(`portal_${o.id}`);
  revalidatePath(`/p/${slug}`);
}
