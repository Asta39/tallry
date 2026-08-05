import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { myExpenseClaims, pendingExpenseClaims, reviewedExpenseClaims, listExpenseAccounts, activeAdminApprovalClaimIds } from "@/lib/expense-claims";
import { db, bankAccounts, paymentGateways } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { bankAccountLabel } from "@/lib/bank-label";
import { PageHeader } from "@/components/ui";
import { ExpenseClaimsClient } from "./ExpenseClaimsClient";

export const dynamic = "force-dynamic";

export default async function ExpenseClaimsPage() {
  await requirePerm("expense_claims");
  const access = await getAccess();
  const canReview = !!access?.perms.has("accountant");
  const canPayout = !!access?.perms.has("can_payout");
  const isOwnerOrAdmin = !!access && (access.isOwner || access.role === "admin");
  const o = await getOrg();

  const [mine, categoryAccounts, pending, reviewed, banks, gateways, awaitingIds] = await Promise.all([
    myExpenseClaims(),
    listExpenseAccounts(),
    canReview ? pendingExpenseClaims() : Promise.resolve([]),
    canReview ? reviewedExpenseClaims() : Promise.resolve([]),
    canReview ? db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))) : Promise.resolve([]),
    canReview && canPayout
      ? db.select().from(paymentGateways).where(and(eq(paymentGateways.orgId, o.id), eq(paymentGateways.enabled, true)))
      : Promise.resolve([]),
    canReview ? activeAdminApprovalClaimIds() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Expense Claims" subtitle="Submit a claim for reimbursement, or review your team's." />
      <ExpenseClaimsClient
        orgId={o.id}
        memberId={access?.memberId ?? null}
        mine={mine}
        categoryAccounts={categoryAccounts}
        canReview={canReview}
        isOwnerOrAdmin={isOwnerOrAdmin}
        awaitingIds={awaitingIds}
        pending={pending}
        reviewed={reviewed}
        banks={banks.map((b) => ({ id: b.id, name: bankAccountLabel(b, o.mpesaTillGatewayId), kind: b.kind }))}
        gateways={gateways.map((g) => ({ id: g.gatewayId, name: g.gatewayId === "mpesa_daraja" ? "M-Pesa Daraja" : "Kopo Kopo" }))}
      />
    </>
  );
}
