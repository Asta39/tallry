import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees, bankAccounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { createAdvanceDirectAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewAdvancePage() {
  await requirePerm("payroll");
  const o = await getOrg();

  const [staff, banks] = await Promise.all([
    db.select().from(employees).where(eq(employees.orgId, o.id)),
    db.select().from(bankAccounts).where(and(eq(bankAccounts.orgId, o.id), eq(bankAccounts.archived, false))),
  ]);

  return (
    <>
      <PageHeader
        title="Issue Salary Advance"
        subtitle="Record an advance for a staff member directly, without waiting for a request"
      />
      <form action={createAdvanceDirectAction} className="card p-6 max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block col-span-2">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Employee</span>
          <select name="employeeId" required className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1">
            <option value="">Select an employee…</option>
            {staff.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Amount (KES)</span>
          <input name="principal" type="number" step="0.01" min="1" required placeholder="0.00" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1" />
        </label>

        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Monthly deduction (KES)</span>
          <input name="installment" type="number" step="0.01" min="1" required placeholder="0.00" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1" />
        </label>

        <label className="block col-span-2">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Disbursed from</span>
          <select name="disbursedFromBankAccountId" defaultValue="" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] mt-1">
            <option value="">Don't record the disbursement — this is a pre-existing balance</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-[var(--color-ink-400)] mt-1">
            Records the cash actually paid out (debits Accounts Receivable, credits this account) — repayments already reduce Accounts Receivable via payroll deductions, so this is what balances it out.
          </p>
        </label>

        <div className="col-span-2 pt-1">
          <PrimaryButton className="px-5 py-2.5">Issue Advance</PrimaryButton>
        </div>
      </form>
    </>
  );
}
