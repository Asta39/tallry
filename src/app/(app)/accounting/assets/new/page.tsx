import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { createAssetAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  await requirePerm("accountant");
  const o = await getOrg();

  // Load all accounts to let the user map the asset, accumulated depreciation, and expense accounts
  const allAccounts = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.archived, false)));
  
  const assetAccounts = allAccounts.filter(a => a.type === "asset");
  const expenseAccounts = allAccounts.filter(a => a.type === "expense");

  return (
    <>
      <PageHeader 
        title="Register Fixed Asset" 
        subtitle="Add a new long-term asset to the register"
      />
      <div className="card max-w-2xl mt-6">
        <form action={createAssetAction} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Asset Name / Description</label>
              <input name="name" type="text" className="input input-bordered w-full" required placeholder="e.g. Delivery Van KCA 123X" />
            </div>

            <div>
              <label className="label">Purchase Date</label>
              <input name="purchaseDate" type="date" className="input input-bordered w-full" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>

            <div>
              <label className="label">Useful Life (Months)</label>
              <input name="usefulLifeMonths" type="number" min="1" className="input input-bordered w-full" required placeholder="e.g. 36" />
            </div>

            <div>
              <label className="label">Purchase Cost (KES)</label>
              <input name="purchaseCost" type="number" step="0.01" min="0.01" className="input input-bordered w-full" required placeholder="0.00" />
            </div>

            <div>
              <label className="label">Salvage / Residual Value (KES)</label>
              <input name="salvageValue" type="number" step="0.01" min="0" className="input input-bordered w-full" defaultValue="0" />
              <div className="text-xs text-base-content/50 mt-1">Value at the end of its useful life</div>
            </div>
          </div>

          <div className="divider">Account Mapping</div>

          <div className="space-y-4">
            <div>
              <label className="label">Fixed Asset Account</label>
              <select name="assetAccountId" className="select select-bordered w-full" required>
                <option value="">Select asset account...</option>
                {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Accumulated Depreciation Account</label>
              <select name="depreciationAccountId" className="select select-bordered w-full" required>
                <option value="">Select contra-asset account...</option>
                {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Depreciation Expense Account</label>
              <select name="expenseAccountId" className="select select-bordered w-full" required>
                <option value="">Select expense account...</option>
                {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" className="btn btn-primary">Register Asset</button>
          </div>
        </form>
      </div>
    </>
  );
}
