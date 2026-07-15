import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getOrgBySlug } from "@/lib/portal";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default_local_secret_change_me");

export async function createClientSession(orgId: number, portalUserId: number, contactId: number, slug: string) {
  const token = await new SignJWT({ orgId, portalUserId, contactId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);

  const jar = await cookies();
  jar.set(`client_portal_${orgId}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 3600,
    path: `/portal/${slug}`,
  });
}

export async function getClientSession(slug: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return null;

  const jar = await cookies();
  const token = jar.get(`client_portal_${o.id}`)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      orgId: payload.orgId as number,
      portalUserId: payload.portalUserId as number,
      contactId: payload.contactId as number,
      org: o,
    };
  } catch {
    return null;
  }
}

export async function destroyClientSession(slug: string) {
  const o = await getOrgBySlug(slug);
  if (!o) return;
  const jar = await cookies();
  jar.delete(`client_portal_${o.id}`);
}
