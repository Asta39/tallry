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

/** A direct cash repayment against a loan, made outside payroll. */
export async function recordLoanRepaymentAction(loanId: number, amountCents: number, bankAccountId: number) {
  const access = await getAccess();
  if (!access) throw new Error("Not logged in");
  if (!amountCents || amountCents <= 0) throw new Error("Enter a valid amount");
  if (!bankAccountId) throw new Error("Select an account");

  await orgContext.run(access.orgId, () =>
    recordLoanRepayment({
      orgId: access.orgId,
      loanId,
      amountCents,
      bankAccountId,
      date: todayISO(),
    })
  );

  revalidatePath(`/payroll/loans/${loanId}`);
  revalidatePath("/payroll/loans");
  revalidatePath("/banking");
}
