import Link from "next/link";
import { requirePerm } from "@/lib/guard";
import { withOrg } from "@/lib/org";
import { debtorsReport, reportStaffNames } from "@/lib/reports";
import { fmtKES } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  await requirePerm("reports");
  const { staff: staffName } = await searchParams;

  const [{ debtors, totalOwedCents }, staff] = await Promise.all([
    withOrg(() => debtorsReport(staffName || undefined)),
    withOrg(() => reportStaffNames()),
  ]);

  return (
    <>
      <PageHeader
        title="Debtors"
        subtitle="Every customer with an outstanding balance — invoices plus any balance brought forward — across all sales agents"
      />

      <form method="GET" className="card p-4 mb-6 bg-[var(--color-ink-50)] border-dashed flex items-end gap-3">
        <div className="w-64">
          <label className="block text-xs font-semibold text-[var(--color-ink-600)] mb-1">Sales agent</label>
          <select
            name="staff"
            defaultValue={staffName ?? ""}
            className="w-full bg-white border border-[var(--color-ink-200)] text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-100)] focus:border-[var(--color-accent-500)]"
          >
            <option value="">All sales agents</option>
            {staff.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary px-5 py-2 text-sm whitespace-nowrap">Filter</button>
      </form>

      <div className="card px-5 py-4 mb-6 inline-block">
        <div className="text-[12.5px] text-[var(--color-ink-600)]">
          {staffName ? `Owed on ${staffName}'s invoices` : "Total owed by all debtors"}
        </div>
        <div className="money-lg mt-1">{fmtKES(totalOwedCents)}</div>
      </div>

      {debtors.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          {staffName ? `No outstanding balances on ${staffName}'s invoices.` : "No outstanding customer balances — everyone's paid up."}
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Customer</Th>
              <Th>Sales agent(s)</Th>
              <Th right>Invoices</Th>
              <Th right>Oldest overdue</Th>
              <Th right>Total owed</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {debtors.map((d) => (
              <tr key={d.contactId} className="hairline-t">
                <Td className="font-medium">{d.customerName}</Td>
                <Td className="text-[var(--color-ink-600)]">
                  {d.agents.length > 0 ? d.agents.join(", ") : d.hasOpeningBalance ? "— (opening balance)" : "—"}
                </Td>
                <Td right className="tnum">{d.invoiceCount || "—"}</Td>
                <Td right className={d.oldestDaysOverdue > 0 ? "text-[var(--color-bad)] font-semibold tnum" : "tnum"}>
                  {d.oldestDaysOverdue > 0 ? `${d.oldestDaysOverdue}d` : "—"}
                </Td>
                <Td right className="font-medium tnum">{fmtKES(d.totalOwedCents)}</Td>
                <Td right>
                  <Link href={`/contacts/${d.contactId}?tab=statement`} className="text-[12.5px] text-[var(--color-accent-600)] hover:underline">
                    Statement →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
