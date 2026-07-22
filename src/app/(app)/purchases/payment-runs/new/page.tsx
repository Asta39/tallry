import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, bankAccounts } from "@/db";
import { eq, and } from "drizzle-orm";
import { listPayableBills } from "@/lib/payment-runs";
import { PageHeader } from "@/components/ui";
import { NewPaymentRunClient } from "./NewPaymentRunClient";

export const dynamic = "force-dynamic";

export default async function NewPaymentRunPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const [bills, banks] = await Promise.all([
    listPayableBills(),
    db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))),
  ]);

  return (
    <>
      <PageHeader title="New Payment Run" subtitle="Select the bills to pay and the account to pay from" />
      <NewPaymentRunClient
        bills={bills}
        banks={banks.map((b) => ({ id: b.id, name: b.name }))}
      />
    </>
  );
}
