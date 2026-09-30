"use server";

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/access";
import { orgContext } from "@/lib/org";
import { logAudit } from "@/lib/audit";
import { fmtKES, todayISO } from "@/lib/money";
import { createExternalLoan, recordExternalLoanRepayment, parseReceiptSource } from "@/lib/external-loans";

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
        startDate: input.startDate,
        receivedInto,
        interestRateBp: rate != null ? Math.round(rate * 100) : null,
        notes: input.notes,
      })
    );
    await logAudit({
      action: "create",
      module: "loans",
      recordId: id,
      recordLabel: input.lender,
      detail: `Business loan ${fmtKES(input.principalCents)} from ${input.lender}${receivedInto === "already_recorded" ? " (already in the books — no entry posted)" : ""}`,
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
  principalCents: number;
  interestCents: number;
  interestAccountId?: number | null;
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
        principalCents: input.principalCents,
        interestCents: input.interestCents,
        interestAccountId: input.interestAccountId || null,
        bankAccountId: input.bankAccountId,
        reference: input.reference,
      })
    );
    await logAudit({
      action: "update",
      module: "loans",
      recordId: input.loanId,
      detail: `Loan repayment on ${input.date}: principal ${fmtKES(input.principalCents)}, interest ${fmtKES(input.interestCents)}`,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not record the repayment" };
  }
  revalidatePath("/accounting/loans");
  revalidatePath(`/accounting/loans/${input.loanId}`);
  revalidatePath("/banking");
  return {};
}
