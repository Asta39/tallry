import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRuns } from "@/db";
import { eq, desc } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td, PrimaryButton } from "@/components/ui";
import Link from "next/link";
import { createPayrollRunAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PayrollRunsPage() {
  await requirePerm("payroll");
  const o = await getOrg();
  
  const runs = await db.select().from(payrollRuns).where(eq(payrollRuns.orgId, o.id)).orderBy(desc(payrollRuns.month));

  return (
    <>
      <PageHeader 
        title="Payroll" 
        subtitle="Manage monthly payroll runs and statutory deductions"
      />

      <div className="flex justify-between items-center mb-4 mt-6">
        <h2 className="font-semibold text-[14px]">Recent Runs</h2>
        <form action={createPayrollRunAction} className="flex gap-2 items-center">
          <input name="month" type="month" required className="rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]" defaultValue={new Date().toISOString().slice(0, 7)} />
          <PrimaryButton type="submit">Create Run</PrimaryButton>
        </form>
      </div>

      {runs.length === 0 ? (
        <div className="mt-8 text-center text-[var(--color-ink-500)] text-[13px]">
          No payroll runs found.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Month</Th>
              <Th>Status</Th>
              <Th>Journal Entry</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">{r.month}</Td>
                <Td>
                  <span className={`badge badge-sm ${r.status === 'posted' ? 'badge-success badge-outline' : 'badge-warning badge-outline'}`}>
                    {r.status}
                  </span>
                </Td>
                <Td>{r.journalEntryId ? `#${r.journalEntryId}` : "-"}</Td>
                <Td right>
                  <Link href={`/payroll/runs/${r.id}`} className="text-[var(--color-accent-600)] font-medium text-[12px]">View</Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
