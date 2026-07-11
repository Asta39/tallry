import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, employees } from "@/db";
import { eq } from "drizzle-orm";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { createLoanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewLoanPage() {
  await requirePerm("payroll");
  const o = await getOrg();

  const staff = await db.select().from(employees).where(eq(employees.orgId, o.id));

  return (
    <>
      <PageHeader 
        title="Issue Loan" 
        subtitle="Record a new salary advance or loan for an employee"
      />
      <div className="card max-w-2xl mt-6">
        <form action={createLoanAction} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Employee</label>
              <select name="employeeId" required className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]">
                <option value="">Select an employee...</option>
                {staff.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Principal Amount (KES)</label>
              <input name="principal" type="number" step="0.01" min="1" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required placeholder="0.00" />
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Monthly Installment (KES)</label>
              <input name="installment" type="number" step="0.01" min="1" className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" required placeholder="0.00" />
            </div>

            <div className="col-span-2">
              <label className="block text-[11.5px] font-medium text-[var(--color-ink-500)] mb-1">Loan Type</label>
              <select name="type" required className="w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]">
                <option value="amortizing">Amortizing (Reducing Balance)</option>
                <option value="recurring_fixed">Recurring Fixed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <PrimaryButton type="submit">Issue Loan</PrimaryButton>
          </div>
        </form>
      </div>
    </>
  );
}
