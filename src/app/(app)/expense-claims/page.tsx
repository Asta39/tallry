import { requirePerm } from "@/lib/guard";
import { getAccess } from "@/lib/access";
import { myExpenseClaims, pendingExpenseClaims, reviewedExpenseClaims, listExpenseAccounts } from "@/lib/expense-claims";
import { db, bankAccounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { PageHeader } from "@/components/ui";
import { ExpenseClaimsClient } from "./ExpenseClaimsClient";

export const dynamic = "force-dynamic";

export default async function ExpenseClaimsPage() {
  await requirePerm("expense_claims");
  const access = await getAccess();
  const canReview = !!access?.perms.has("accountant");
  const o = await getOrg();

  const [mine, categoryAccounts, pending, reviewed, banks] = await Promise.all([
    myExpenseClaims(),
    listExpenseAccounts(),
    canReview ? pendingExpenseClaims() : Promise.resolve([]),
    canReview ? reviewedExpenseClaims() : Promise.resolve([]),
    canReview ? db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Expense Claims" subtitle="Submit a claim for reimbursement, or review your team's." />
      <ExpenseClaimsClient
        mine={mine}
        categoryAccounts={categoryAccounts}
        canReview={canReview}
        pending={pending}
        reviewed={reviewed}
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
      />
    </>
  );
}
