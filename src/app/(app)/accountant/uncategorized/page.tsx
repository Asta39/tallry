import { listUncategorizedLines, categoryAccountOptions, costCenterOptions } from "@/lib/reclass";
import { PageHeader } from "@/components/ui";
import { UncategorizedLinesClient } from "./UncategorizedLinesClient";

export const dynamic = "force-dynamic";

export default async function UncategorizedPage() {
  const [lines, accounts, costCenters] = await Promise.all([
    listUncategorizedLines(),
    categoryAccountOptions(),
    costCenterOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Uncategorized transactions"
        subtitle="Already-posted invoices/bills/expenses whose lines never got a category — assign one and the ledger is reclassed to match, without touching the original totals."
      />
      <UncategorizedLinesClient lines={lines} accounts={accounts} costCenters={costCenters} />
    </>
  );
}
