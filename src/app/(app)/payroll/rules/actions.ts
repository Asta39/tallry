"use server";

import { db, statutoryRules } from "@/db";
import { getAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { nowISO } from "@/lib/money";

export async function createRuleAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");

  const type = String(formData.get("type"));
  const calculationType = String(formData.get("calculationType"));
  const effectiveFrom = String(formData.get("effectiveFrom"));
  const parametersJson = String(formData.get("parametersJson"));

  if (!type || !calculationType || !effectiveFrom || !parametersJson) {
    throw new Error("Invalid input");
  }

  await db.insert(statutoryRules).values({
    orgId: access.orgId,
    type,
    calculationType,
    effectiveFrom,
    effectiveTo: null,
    parametersJson,
    createdAt: nowISO(),
  });

  redirect("/payroll/rules");
}
