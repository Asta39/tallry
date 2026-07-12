import crypto from "crypto";
import { db, org, contacts, payments, paymentEvents, portalOtps, portalSessions, documents } from "@/db";
import { and, eq, gt, sql, desc, inArray } from "drizzle-orm";
import { normalizeKePhone, getOrgSmsConfig, sendSms } from "@/lib/sms";

const OTP_TTL_MS = 10 * 60 * 1000;         // 10 minutes
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const MAX_ATTEMPTS = 5;
const MAX_OTPS_PER_HOUR = 3;

function hashCode(code: string, phone: string): string {
  return crypto.createHash("sha256").update(`${code}:${phone}`).digest("hex");
}

export async function getOrgBySlug(slug: string) {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const [row] = await db.select().from(org).where(eq(org.portalSlug, slug));
  return row ?? null;
}

/** True if this phone has ever paid or is a contact of the org. */
async function phoneKnownToOrg(orgId: number, phone: string): Promise<boolean> {
  const last9 = phone.slice(-9);
  const [c] = await db.select({ id: contacts.id }).from(contacts)
    .where(and(
      eq(contacts.orgId, orgId),
      sql`REGEXP_REPLACE(COALESCE(${contacts.phone}, ''), '[^0-9]', '', 'g') LIKE ${"%" + last9}`
    )).limit(1);
  if (c) return true;
  const [e] = await db.select({ id: paymentEvents.id }).from(paymentEvents)
    .where(and(
      eq(paymentEvents.orgId, orgId),
      sql`REGEXP_REPLACE(COALESCE(${paymentEvents.payerPhone}, ''), '[^0-9]', '', 'g') LIKE ${"%" + last9}`
    )).limit(1);
  return !!e;
}

/**
 * Request an OTP. Always resolves without revealing whether the phone is
 * known — an SMS is only actually sent to known payers/contacts.
 */
export async function requestPortalOtp(orgId: number, rawPhone: string): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizeKePhone(rawPhone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan mobile number" };

  // Checked before the known-phone lookup so the error is identical for
  // known and unknown numbers (no enumeration).
  const cfg = await getOrgSmsConfig(orgId);
  if (!cfg) return { ok: false, error: "SMS is not configured for this business" };

  // Rate limit per phone per org
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recent = await db.select({ id: portalOtps.id }).from(portalOtps)
    .where(and(eq(portalOtps.orgId, orgId), eq(portalOtps.phone, phone), gt(portalOtps.createdAt, hourAgo)));
  if (recent.length >= MAX_OTPS_PER_HOUR) {
    return { ok: false, error: "Too many codes requested — try again in an hour" };
  }

  const known = await phoneKnownToOrg(orgId, phone);
  const code = crypto.randomInt(1000, 10000).toString(); // 4 digits

  await db.insert(portalOtps).values({
    orgId,
    phone,
    codeHash: hashCode(code, phone),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  });

  if (known) {
    const res = await sendSms(cfg, phone, `Your receipts access code is ${code}. Valid for 10 minutes.`);
    if (!res.ok) console.error("Portal OTP SMS failed:", res.error);
  }
  // Unknown phones get the same success response (no enumeration), just no SMS.
  return { ok: true };
}

export async function verifyPortalOtp(orgId: number, rawPhone: string, code: string): Promise<{ token?: string; error?: string }> {
  const phone = normalizeKePhone(rawPhone);
  if (!phone || !/^\d{4}$/.test(code)) return { error: "Invalid code" };

  const [otp] = await db.select().from(portalOtps)
    .where(and(
      eq(portalOtps.orgId, orgId),
      eq(portalOtps.phone, phone),
      eq(portalOtps.consumed, false),
      gt(portalOtps.expiresAt, new Date().toISOString()),
    ))
    .orderBy(desc(portalOtps.id)).limit(1);

  if (!otp) return { error: "Code expired — request a new one" };
  if (otp.attempts >= MAX_ATTEMPTS) return { error: "Too many attempts — request a new code" };

  await db.update(portalOtps).set({ attempts: otp.attempts + 1 }).where(eq(portalOtps.id, otp.id));

  const expected = Buffer.from(otp.codeHash, "utf8");
  const actual = Buffer.from(hashCode(code, phone), "utf8");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return { error: "Wrong code" };
  }

  await db.update(portalOtps).set({ consumed: true }).where(eq(portalOtps.id, otp.id));

  const token = crypto.randomBytes(24).toString("hex");
  await db.insert(portalSessions).values({
    orgId,
    phone,
    token,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return { token };
}

export async function getPortalSession(orgId: number, token: string | undefined) {
  if (!token || !/^[a-f0-9]{48}$/.test(token)) return null;
  const [s] = await db.select().from(portalSessions)
    .where(and(
      eq(portalSessions.token, token),
      eq(portalSessions.orgId, orgId),
      gt(portalSessions.expiresAt, new Date().toISOString()),
    ));
  return s ?? null;
}

/** All incoming payments attributable to this phone (via contact or gateway event). */
export async function getReceiptsForPhone(orgId: number, phone: string) {
  const last9 = phone.slice(-9);

  const matchingContacts = await db.select({ id: contacts.id }).from(contacts)
    .where(and(
      eq(contacts.orgId, orgId),
      sql`REGEXP_REPLACE(COALESCE(${contacts.phone}, ''), '[^0-9]', '', 'g') LIKE ${"%" + last9}`
    ));
  const contactIds = matchingContacts.map(c => c.id);

  const eventPaymentIds = (await db.select({ paymentId: paymentEvents.paymentId }).from(paymentEvents)
    .where(and(
      eq(paymentEvents.orgId, orgId),
      sql`REGEXP_REPLACE(COALESCE(${paymentEvents.payerPhone}, ''), '[^0-9]', '', 'g') LIKE ${"%" + last9}`
    ))).map(r => r.paymentId).filter((x): x is number => x != null);

  const conditions = [];
  if (contactIds.length) conditions.push(inArray(payments.contactId, contactIds));
  if (eventPaymentIds.length) conditions.push(inArray(payments.id, eventPaymentIds));
  if (!conditions.length) return [];

  const rows = await db.select({ payment: payments, doc: documents }).from(payments)
    .leftJoin(documents, eq(documents.id, payments.documentId))
    .where(and(
      eq(payments.orgId, orgId),
      eq(payments.direction, "in"),
      sql`(${sql.join(conditions, sql` OR `)})`,
    ))
    .orderBy(desc(payments.id))
    .limit(100);

  return rows;
}
