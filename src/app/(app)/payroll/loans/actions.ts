"use server";

import { getAccess } from "@/lib/access";
import { orgContext } from "@/lib/org";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { issueStaffLoan, recordLoanRepayment } from "@/lib/staff-loans";
import { todayISO } from "@/lib/money";

export async function createLoanAction(formData: FormData) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  // issueStaffLoan() -> postEntry()/mirrorBankTxn() resolve the org via
  // AsyncLocalStorage (currentOrgId()), not a parameter — without this,
  // issuing a loan with a "Disbursed from" account picked threw "No
  // organization in context" uncaught, crashing to the generic error page.
  // Reported live as "loans and deductions giving an error."
  await orgContext.run(access.orgId, () => _createLoan(access, formData));
  redirect("/payroll/loans");
}

async function _createLoan(access: NonNullable<Awaited<ReturnType<typeof getAccess>>>, formData: FormData) {
  const employeeId = Number(formData.get("employeeId"));
  const principalCents = Math.round(Number(formData.get("principal")) * 100);
  const installmentCents = Math.round(Number(formData.get("installment")) * 100);
  const type = String(formData.get("type")) || "amortizing";
  const disbursedFromBankAccountId = formData.get("disbursedFromBankAccountId") ? Number(formData.get("disbursedFromBankAccountId")) : null;

  if (!employeeId || principalCents <= 0 || installmentCents <= 0) {
    throw new Error("Invalid input");
  }

  await issueStaffLoan({
    orgId: access.orgId,
    employeeId,
    principalCents,
    installmentCents,
    type,
    kind: "loan",
    disbursedFromBankAccountId,
    memoVerb: "Staff loan issued",
  });
}

/**
 * A direct cash/M-Pesa repayment against a staff loan or salary advance, made
 * outside payroll. Returns an error instead of throwing: production Next
 * redacts thrown server-action messages to a generic "Server Components
 * render" error, which hid every real reason (amount over balance, locked
 * period, …) from the accountant.
 */
export async function recordLoanRepaymentAction(
  loanId: number,
  amountCents: number,
  bankAccountId: number,
  date?: string
): Promise<{ error?: string }> {
  const access = await getAccess();
  if (!access) return { error: "Not logged in" };
  // Same gate as the Loans / Salary Advances pages that render this form —
  // previously any signed-in member could post a repayment.
  if (!access.isOwner && access.role !== "admin" && !access.perms.has("payroll")) {
    return { error: "You need Payroll access to record a loan repayment" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { error: "Enter a valid amount" };
  if (!bankAccountId) return { error: "Select an account" };
  const today = todayISO();
  const repaidOn = date || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(repaidOn)) return { error: "Enter a valid date" };
  if (repaidOn > today) return { error: "Repayment date can't be in the future" };

  try {
    await orgContext.run(access.orgId, () =>
      recordLoanRepayment({
        orgId: access.orgId,
        loanId,
        amountCents,
        bankAccountId,
        date: repaidOn,
      })
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the repayment" };
  }

  revalidatePath(`/payroll/loans/${loanId}`);
  revalidatePath("/payroll/loans");
  revalidatePath("/payroll/advances");
  revalidatePath("/banking");
  return {};
}
