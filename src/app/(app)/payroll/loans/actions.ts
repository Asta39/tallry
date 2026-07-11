"use server";

import { db, loanLedger, employees } from "@/db";
import { getAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import { nowISO } from "@/lib/money";

export async function createLoanAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");

  const employeeId = Number(formData.get("employeeId"));
  const principalCents = Math.round(Number(formData.get("principal")) * 100);
  const installmentCents = Math.round(Number(formData.get("installment")) * 100);
  const type = String(formData.get("type")) || "amortizing";

  if (!employeeId || principalCents <= 0 || installmentCents <= 0) {
    throw new Error("Invalid input");
  }

  await db.insert(loanLedger).values({
    orgId: access.orgId,
    employeeId,
    principalCents,
    balanceCents: principalCents,
    installmentCents,
    type,
    status: "active",
    createdAt: nowISO(),
  });

  redirect("/payroll/loans");
}
