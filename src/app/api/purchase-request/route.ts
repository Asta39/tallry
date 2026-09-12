import { NextRequest, NextResponse } from "next/server";
import { db, purchaseRequests } from "@/db";
import { getSuperAdminEmails } from "@/lib/super-admin";
import { getPricingPackage } from "@/lib/pricing-packages";
import { fmtKES } from "@/lib/money";
import { sendEmail } from "@/lib/email/resend";
import { PurchaseRequestNotice } from "@/lib/email/templates/PurchaseRequestNotice";
import { RateLimiter } from "@/lib/ai/marketing-assistant";

/**
 * Public endpoint for the pricing page's "One-time purchase" form.
 * Unauthenticated by design — there is no account yet. Package price is
 * looked up server-side from pricing-packages.ts by key, never trusted
 * from the request body, so the amount can't be tampered with client-side.
 */

export const dynamic = "force-dynamic";

const limiter = new RateLimiter(5, 60_000);

function callerKey(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!limiter.allow(callerKey(req))) {
    return NextResponse.json({ error: "Too many requests — please wait a moment and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, phone, email, packageKey } = body as Record<string, unknown>;

  const cleanName = typeof name === "string" ? name.trim().slice(0, 200) : "";
  const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 40) : "";
  const cleanEmail = typeof email === "string" ? email.trim().slice(0, 200) : "";

  if (!cleanName) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!cleanPhone) return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });

  const pkg = getPricingPackage(packageKey);
  if (!pkg) return NextResponse.json({ error: "Invalid package selection." }, { status: 400 });

  const createdAt = new Date().toISOString();

  await db.insert(purchaseRequests).values({
    name: cleanName,
    phone: cleanPhone,
    email: cleanEmail,
    packageKey: pkg.key,
    packageLabel: pkg.label,
    amountCents: pkg.amountCents,
    status: "pending",
    createdAt,
  });

  try {
    const admins = await getSuperAdminEmails();
    const amount = fmtKES(pkg.amountCents);
    await Promise.all(
      admins.map((to) =>
        sendEmail({
          to,
          subject: `New purchase request: ${cleanName} — ${pkg.label} (${amount})`,
          react: PurchaseRequestNotice({
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            packageLabel: pkg.label,
            amount,
            createdAt: createdAt.slice(0, 16).replace("T", " "),
          }),
        })
      )
    );
  } catch (e) {
    // The request is already saved — a notification-email failure must
    // never make this look like it failed to the prospect.
    console.error("purchase-request: failed to email admins", e);
  }

  return NextResponse.json({ ok: true });
}
