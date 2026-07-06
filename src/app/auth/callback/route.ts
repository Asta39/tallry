import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db, org, accounts, bankAccounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { SEED_ACCOUNTS } from "@/lib/coa";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (code) {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    // Password recovery flow — skip org setup, go straight to update-password
    if (!error && type === "recovery") {
      return NextResponse.redirect(`${origin}/update-password`);
    }
    if (!error && data.user) {
      const userId = data.user.id;

      // Check if this user already has an org
      const [existing] = await db
        .select()
        .from(org)
        .where(eq(org.userId, userId))
        .limit(1);

      if (!existing) {
        // --- Auto-provision: create org + seed Kenyan COA ---
        const [newOrg] = await db.insert(org).values({
          userId,
          name: "", // will be set on /onboarding
          vatRegistered: true,
          invoicePrefix: "INV-",
          cuSerial: "SIMCU0000000001",
        }).returning();

        const orgId = newOrg.id;

        // Seed chart of accounts (idempotent check by code)
        for (const a of SEED_ACCOUNTS) {
          const [existingAcc] = await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.code, a.code), eq(accounts.orgId, orgId)))
            .limit(1);
          if (!existingAcc) {
            await db.insert(accounts).values({
              orgId,
              code: a.code,
              name: a.name,
              type: a.type,
              subtype: a.subtype,
              isSystem: a.system ?? false,
            });
          }
        }

        // Seed default money accounts
        const existingBanks = await db.select().from(bankAccounts).where(eq(bankAccounts.orgId, orgId));
        if (existingBanks.length === 0) {
          const [bankCoa] = await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.code, "1000"), eq(accounts.orgId, orgId)))
            .limit(1);
          const [mpesaCoa] = await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.code, "1010"), eq(accounts.orgId, orgId)))
            .limit(1);
          const [cashCoa] = await db
            .select()
            .from(accounts)
            .where(and(eq(accounts.code, "1020"), eq(accounts.orgId, orgId)))
            .limit(1);
          if (bankCoa && mpesaCoa && cashCoa) {
            await db.insert(bankAccounts).values([
              { orgId, name: "Main Bank Account", kind: "bank", accountId: bankCoa.id },
              { orgId, name: "M-Pesa Till", kind: "mpesa", accountId: mpesaCoa.id },
              { orgId, name: "Petty Cash", kind: "cash", accountId: cashCoa.id },
            ]);
          }
        }

        // New user → go to onboarding
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // Existing user — check if they completed onboarding
      if (!existing.name) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
