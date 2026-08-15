import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, accounts, bankAccounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/ui";
import { createAssetAction } from "../actions";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1";
const label = "text-[12px] font-medium text-[var(--color-ink-600)]";

export default async function NewAssetPage() {
  await requirePerm("fixed_assets");
  const o = await getOrg();

  // Load all accounts to let the user map the asset, accumulated depreciation, and expense accounts
  const [allAccounts, banks] = await Promise.all([
    db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.archived, false))),
    db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))),
  ]);

  const assetAccounts = allAccounts.filter(a => a.type === "asset");
  const expenseAccounts = allAccounts.filter(a => a.type === "expense");

  return (
    <>
      <PageHeader
        title="Register Fixed Asset"
        subtitle="Add a new long-term asset to the register"
      />
      <form action={createAssetAction} className="card p-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block col-span-2">
          <span className={label}>Asset Name / Description</span>
          <input name="name" type="text" required placeholder="e.g. Delivery Van KCA 123X" className={input} />
        </label>

        <label className="block">
          <span className={label}>Purchase Date</span>
          <input name="purchaseDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={input} />
        </label>

        <label className="block">
          <span className={label}>Useful Life (Months)</span>
          <input name="usefulLifeMonths" type="number" min="1" required placeholder="e.g. 36" className={input} />
        </label>

        <label className="block">
          <span className={label}>Purchase Cost (KES)</span>
          <input name="purchaseCost" type="number" step="0.01" min="0.01" required placeholder="0.00" className={input} />
        </label>

        <label className="block">
          <span className={label}>Salvage / Residual Value (KES)</span>
          <input name="salvageValue" type="number" step="0.01" min="0" defaultValue="0" className={input} />
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1">Value at the end of its useful life</p>
        </label>

        <label className="block col-span-2">
          <span className={label}>Paid from</span>
          <select name="paidFromBankAccountId" defaultValue="" className={input}>
            <option value="">Skip — I already booked this purchase elsewhere (bill/expense)</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
            Pick the account this was actually paid from so the cost debits the asset account and credits this account — <strong>without this, the asset&apos;s value won&apos;t show up under its asset account at all</strong>, only in this register. Skip only if the purchase already hit the books another way (a bill/expense) — picking a bank on top of that would double-count it. You can record it later from the asset list if you skip by mistake.
          </p>
        </label>

        <div className="col-span-2 hairline-t pt-4">
          <div className="text-[12px] font-semibold text-[var(--color-ink-600)] mb-3">Account Mapping</div>
        </div>

        <label className="block col-span-2">
          <span className={label}>Fixed Asset Account</span>
          <select name="assetAccountId" required className={input}>
            <option value="">Select asset account…</option>
            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>

        <label className="block col-span-2">
          <span className={label}>Accumulated Depreciation Account</span>
          <select name="depreciationAccountId" required className={input}>
            <option value="">Select contra-asset account…</option>
            {assetAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>

        <label className="block col-span-2">
          <span className={label}>Depreciation Expense Account</span>
          <select name="expenseAccountId" required className={input}>
            <option value="">Select expense account…</option>
            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
          </select>
        </label>

        <div className="col-span-2 pt-1">
          <button className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-5 py-2.5">
            Register Asset
          </button>
        </div>
      </form>
    </>
  );
}
