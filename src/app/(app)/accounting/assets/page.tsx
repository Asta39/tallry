import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, fixedAssets, bankAccounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";
import { DepreciationRunner } from "./DepreciationRunner";
import { DisposeAssetButton } from "./DisposeAssetButton";
import { RecordPurchaseButton } from "./RecordPurchaseButton";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  await requirePerm("fixed_assets");
  const o = await getOrg();

  const [assets, banks] = await Promise.all([
    db.select().from(fixedAssets).where(eq(fixedAssets.orgId, o.id)),
    db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))),
  ]);

  return (
    <>
      <PageHeader
        title="Fixed Assets"
        subtitle="Manage and depreciate long-term assets"
        action={
          <Link
            href="/accounting/assets/new"
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2 transition-colors"
          >
            Register Asset
          </Link>
        }
      />

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)]">Asset Register</h2>
        <DepreciationRunner />
      </div>

      {assets.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No fixed assets registered yet.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Asset Name</Th>
              <Th>Purchase Date</Th>
              <Th right>Cost</Th>
              <Th>Useful Life</Th>
              <Th>Method</Th>
              <Th>Status</Th>
              <Th>Ledger</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="hairline-b">
                <Td className="font-medium">{a.name}</Td>
                <Td>{a.purchaseDate}</Td>
                <Td right>{fmtKES(a.purchaseCostCents)}</Td>
                <Td>{a.usefulLifeMonths} mos</Td>
                <Td className="capitalize">{a.depreciationMethod.replace("_", " ")}</Td>
                <Td>
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      a.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]"
                    }`}
                  >
                    {a.status === "disposed" && a.disposalType
                      ? { sale: "sold", scrap: "scrapped", trade: "traded in" }[a.disposalType] ?? a.status
                      : a.status}
                  </span>
                </Td>
                <Td>
                  {a.purchaseJournalEntryId ? (
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-[var(--color-ink-100)] text-[var(--color-ink-600)]">
                      Recorded
                    </span>
                  ) : (
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700"
                      title="Cost hasn't posted to the asset account yet"
                    >
                      Not recorded
                    </span>
                  )}
                </Td>
                <Td right>
                  <div className="flex flex-col items-end gap-1.5">
                    {!a.purchaseJournalEntryId && (
                      <RecordPurchaseButton assetId={a.id} banks={banks.map((b) => ({ id: b.id, name: b.name }))} />
                    )}
                    {a.status === "active" && (
                      <DisposeAssetButton assetId={a.id} assetName={a.name} banks={banks.map((b) => ({ id: b.id, name: b.name }))} />
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
