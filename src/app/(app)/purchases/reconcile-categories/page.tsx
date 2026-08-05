import { requirePerm } from "@/lib/guard";
import { listUncategorizedSpendLines, listExpenseCategoryOptions, listCostCenterOptions } from "@/lib/category-reconcile";
import { PageHeader } from "@/components/ui";
import { ReconcileCategoriesClient } from "./ReconcileCategoriesClient";

export const dynamic = "force-dynamic";

export default async function ReconcileCategoriesPage() {
  await requirePerm("accountant");

  const [lines, categories, costCenterOpts] = await Promise.all([
    listUncategorizedSpendLines(),
    listExpenseCategoryOptions(),
    listCostCenterOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Reconcile bill categories"
        subtitle="Bills posted before Category was mandatory — assign one to move the amount out of Misc. expense into the right account."
      />
      <ReconcileCategoriesClient
        initialLines={lines.map((l) => ({
          lineId: l.lineId,
          documentId: l.documentId,
          description: l.description,
          netCents: l.netCents,
          docNumber: l.docNumber,
          docDate: l.docDate,
        }))}
        categories={categories.map((c) => ({ id: c.id, label: `${c.code} · ${c.name}` }))}
        costCenters={costCenterOpts.map((c) => ({ id: c.id, label: c.name }))}
      />
    </>
  );
}
