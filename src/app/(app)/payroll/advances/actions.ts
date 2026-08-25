"use server";

import { db, members, salaryAdvanceRequests } from "@/db";
import { and, eq } from "drizzle-orm";
import { getAccess } from "@/lib/access";
import { orgContext } from "@/lib/org";
import { redirect } from "next/navigation";
import { nowISO } from "@/lib/money";
import { issueStaffLoan } from "@/lib/staff-loans";
import { revalidatePath } from "next/cache";

/** Resolve the logged-in member's own employee record — needed for every
 *  staff self-service action below. Returns null (not a throw) when the
 *  admin hasn't linked this login to a payroll employee yet, so callers can
 *  show a clear message instead of crashing. */
async function myEmployeeId(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>): Promise<number | null> {
  if (!access.memberId) return null;
  const [m] = await db.select({ employeeId: members.employeeId }).from(members).where(eq(members.id, access.memberId)).limit(1);
  return m?.employeeId ?? null;
}

/** A staff member (salary_advances perm, no payroll access) asking for an advance. */
export async function requestAdvanceAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  if (!access.perms.has("salary_advances")) throw new Error("Not authorized");

  const employeeId = await myEmployeeId(access);
  if (!employeeId) throw new Error("Your account isn't linked to a payroll employee record yet — ask your admin to link it in Staff & Roles first.");

  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!amountCents || amountCents <= 0) throw new Error("Enter an amount greater than zero");

  await db.insert(salaryAdvanceRequests).values({
    orgId: access.orgId,
    employeeId,
    requestedByMemberId: access.memberId,
    amountCents,
    reason,
    status: "pending",
    createdAt: nowISO(),
  });
  revalidatePath("/payroll/advances");
  redirect("/payroll/advances");
}

/** Admin/accountant approves a pending request — actually disburses it. */
export async function approveAdvanceRequestAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  if (!access.perms.has("payroll")) throw new Error("Not authorized");

  const requestId = Number(formData.get("requestId"));
  const installmentCents = Math.round(Number(formData.get("installment")) * 100);
  const disbursedFromBankAccountId = formData.get("disbursedFromBankAccountId") ? Number(formData.get("disbursedFromBankAccountId")) : null;
  if (!installmentCents || installmentCents <= 0) throw new Error("Enter a monthly deduction amount greater than zero");

  await orgContext.run(access.orgId, () => _approve(access, requestId, installmentCents, disbursedFromBankAccountId));
  revalidatePath("/payroll/advances");
  redirect("/payroll/advances");
}

async function _approve(
  access: NonNullable<Awaited<ReturnType<typeof getAccess>>>,
  requestId: number,
  installmentCents: number,
  disbursedFromBankAccountId: number | null
) {
  const [req] = await db.select().from(salaryAdvanceRequests).where(and(eq(salaryAdvanceRequests.orgId, access.orgId), eq(salaryAdvanceRequests.id, requestId))).limit(1);
  if (!req) throw new Error("Request not found");
  if (req.status !== "pending") throw new Error("This request was already reviewed");

  const loanId = await issueStaffLoan({
    orgId: access.orgId,
    employeeId: req.employeeId,
    principalCents: req.amountCents,
    installmentCents,
    type: "amortizing",
    kind: "advance",
    disbursedFromBankAccountId,
    memoVerb: "Salary advance issued",
  });

  await db.update(salaryAdvanceRequests).set({
    status: "approved",
    loanLedgerId: loanId,
    reviewedByName: access.memberName || "Admin",
    reviewedAt: nowISO(),
  }).where(eq(salaryAdvanceRequests.id, requestId));
}

export async function rejectAdvanceRequestAction(requestId: number, note: string) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  if (!access.perms.has("payroll")) throw new Error("Not authorized");

  await db.update(salaryAdvanceRequests).set({
    status: "rejected",
    reviewNote: note || null,
    reviewedByName: access.memberName || "Admin",
    reviewedAt: nowISO(),
  }).where(and(eq(salaryAdvanceRequests.orgId, access.orgId), eq(salaryAdvanceRequests.id, requestId)));
  revalidatePath("/payroll/advances");
}

/** Admin/accountant issuing an advance directly for a staff member, skipping the request step. */
export async function createAdvanceDirectAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  if (!access.perms.has("payroll")) throw new Error("Not authorized");

  const employeeId = Number(formData.get("employeeId"));
  const principalCents = Math.round(Number(formData.get("principal")) * 100);
  const installmentCents = Math.round(Number(formData.get("installment")) * 100);
  const disbursedFromBankAccountId = formData.get("disbursedFromBankAccountId") ? Number(formData.get("disbursedFromBankAccountId")) : null;
  if (!employeeId || principalCents <= 0 || installmentCents <= 0) throw new Error("Invalid input");

  await orgContext.run(access.orgId, () =>
    issueStaffLoan({
      orgId: access.orgId,
      employeeId,
      principalCents,
      installmentCents,
      type: "amortizing",
      kind: "advance",
      disbursedFromBankAccountId,
      memoVerb: "Salary advance issued",
    })
  );
  redirect("/payroll/advances");
}
