"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { orgContext } from "@/lib/org";
import { logAudit } from "@/lib/audit";
import { fmtKES, todayISO } from "@/lib/money";
import { createExternalLoan, recordExternalLoanRepayment, setupExternalLoanInterest, parseReceiptSource } from "@/lib/external-loans";

// Both actions return { error } instead of throwing: production Next redacts
// thrown server-action messages, so the accountant would only ever see a
// generic "Server Components render" error.

async function loanAccess() {
  const access = await getAccess();
  if (!access) return { error: "Not logged in" } as const;
  if (!access.isOwner && access.role !== "admin" && !access.perms.has("accountant")) {
    return { error: "You need Accountant access to manage business loans" } as const;
  }
  return { access } as const;
}

function checkDate(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Enter a valid date";
  if (date > todayISO()) return "The date can't be in the future";
  return null;
}

export async function createExternalLoanAction(input: {
  lender: string;
  reference?: string;
  liabilityAccountId: number;
  interestAccountId?: number | null;
  principalCents: number;
  interestTotalCents?: number;
  termMonths?: number | null;
  startDate: string;
  receivedInto: string;
  interestRatePct?: number | null;
  notes?: string;
}): Promise<{ error?: string; id?: number }> {
  const a = await loanAccess();
  if ("error" in a) return { error: a.error };
  const receivedInto = parseReceiptSource(input.receivedInto);
  if (!receivedInto) return { error: "Choose where the money was received, or mark it as already in the books" };
  const dateError = checkDate(input.startDate);
  if (dateError) return { error: dateError };
  const rate = input.interestRatePct;
  if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 1000)) return { error: "Enter a valid interest rate" };

  try {
    const id = await orgContext.run(a.access.orgId, () =>
      createExternalLoan({
        orgId: a.access.orgId,
        lender: input.lender,
        reference: input.reference,
        liabilityAccountId: input.liabilityAccountId,
        interestAccountId: input.interestAccountId || null,
        principalCents: input.principalCents,
        interestTotalCents: input.interestTotalCents ?? 0,
        termMonths: input.termMonths ?? null,
        startDate: input.startDate,
        receivedInto,
        interestRateBp: rate != null ? Math.round(rate * 100) : null,
        notes: input.notes,
        asOf: todayISO(),
      })
    );
    await logAudit({
      action: "create",
      module: "loans",
      recordId: id,
      recordLabel: input.lender,
      detail: `Business loan ${fmtKES(input.principalCents)} from ${input.lender}${input.interestTotalCents ? ` + ${fmtKES(input.interestTotalCents)} interest over ${input.termMonths} months` : ""}${receivedInto === "already_recorded" ? " (principal already in the books — not posted again)" : ""}`,
    });
    revalidatePath("/accounting/loans");
    revalidatePath("/banking");
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the loan" };
  }
}

export async function recordExternalLoanRepaymentAction(input: {
  loanId: number;
  date: string;
  amountCents: number;
  bankAccountId: number;
  reference?: string;
}): Promise<{ error?: string }> {
  const a = await loanAccess();
  if ("error" in a) return { error: a.error };
  const dateError = checkDate(input.date);
  if (dateError) return { error: dateError };
  if (!input.bankAccountId) return { error: "Choose the account it was paid from" };

  try {
    await orgContext.run(a.access.orgId, () =>
      recordExternalLoanRepayment({
        orgId: a.access.orgId,
        loanId: input.loanId,
        date: input.date,
        amountCents: input.amountCents,
        bankAccountId: input.bankAccountId,
        reference: input.reference,
      })
    );
    await logAudit({
      action: "update",
      module: "loans",
      recordId: input.loanId,
      detail: `Loan repayment of ${fmtKES(input.amountCents)} on ${input.date}`,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the repayment" };
  }
  revalidatePath("/accounting/loans");
  revalidatePath(`/accounting/loans/${input.loanId}`);
  revalidatePath("/banking");
  return {};
}

/** Adds interest + term to a loan registered without them (e.g. one entered
 *  before interest was part of the outstanding balance). */
export async function setupExternalLoanInterestAction(input: {
  loanId: number;
  interestTotalCents: number;
  termMonths: number;
  interestAccountId: number | null;
}): Promise<{ error?: string }> {
  const a = await loanAccess();
  if ("error" in a) return { error: a.error };
  if (!input.interestTotalCents || input.interestTotalCents <= 0) return { error: "Enter the total interest" };
  try {
    await orgContext.run(a.access.orgId, () =>
      setupExternalLoanInterest({
        orgId: a.access.orgId,
        loanId: input.loanId,
        interestTotalCents: input.interestTotalCents,
        termMonths: input.termMonths,
        interestAccountId: input.interestAccountId,
        asOf: todayISO(),
      })
    );
    await logAudit({
      action: "update",
      module: "loans",
      recordId: input.loanId,
      detail: `Added ${fmtKES(input.interestTotalCents)} interest over ${input.termMonths} months`,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not add the interest" };
  }
  revalidatePath("/accounting/loans");
  revalidatePath(`/accounting/loans/${input.loanId}`);
  return {};
}
