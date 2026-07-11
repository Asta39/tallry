import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, fixedAssets } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import Link from "next/link";
import { DepreciationRunner } from "./DepreciationRunner";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  
  const assets = await db.select().from(fixedAssets).where(
    eq(fixedAssets.orgId, o.id)
  );

  return (
    <>
      <PageHeader 
        title="Fixed Assets" 
        subtitle="Manage and depreciate long-term assets"
        action={<Link href="/accounting/assets/new" className="btn btn-primary">Register Asset</Link>}
      />

      <div className="card bg-base-100 shadow-sm border border-base-content/10 mt-6">
        <div className="flex justify-between items-center p-4 border-b border-base-content/10">
          <h2 className="font-semibold">Asset Register</h2>
          <DepreciationRunner />
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead className="bg-base-200/50">
              <tr>
                <th>Asset Name</th>
                <th>Purchase Date</th>
                <th>Cost</th>
                <th>Useful Life</th>
                <th>Method</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-base-content/50">
                    No fixed assets registered yet.
                  </td>
                </tr>
              ) : (
                assets.map(a => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td>{a.purchaseDate}</td>
                    <td>{fmtKES(a.purchaseCostCents)}</td>
                    <td>{a.usefulLifeMonths} mos</td>
                    <td className="capitalize">{a.depreciationMethod.replace("_", " ")}</td>
                    <td>
                      <span className={`badge ${a.status === 'active' ? 'badge-success badge-outline' : 'badge-neutral'}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
