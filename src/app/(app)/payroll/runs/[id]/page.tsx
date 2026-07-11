import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRuns, payrollRunLineItems, employees, accounts } from "@/db";
import { and, eq } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { notFound } from "next/navigation";
import { PostRunForm } from "./PostRunForm";
import { DeleteRunButton } from "./DeleteRunButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PayrollRunDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePerm("accountant");
  const o = await getOrg();
  const runId = parseInt(params.id, 10);
  
  const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));
  if (!run) return notFound();

  const linesData = await db
    .select({
      line: payrollRunLineItems,
      employeeName: employees.name,
      employeePin: employees.kraPin,
    })
    .from(payrollRunLineItems)
    .innerJoin(employees, eq(payrollRunLineItems.employeeId, employees.id))
    .where(eq(payrollRunLineItems.payrollRunId, run.id));

  // Load all accounts to map for posting
  const allAccounts = await db.select().from(accounts).where(and(eq(accounts.orgId, o.id), eq(accounts.archived, false)));
  const expenseAccounts = allAccounts.filter(a => a.type === "expense");
  const liabilityAccounts = allAccounts.filter(a => a.type === "liability");
  const bankAccounts = allAccounts.filter(a => a.type === "asset"); 

  const empMap = new Map();
  for (const row of linesData) {
    if (!empMap.has(row.line.employeeId)) {
      empMap.set(row.line.employeeId, {
        employeeId: row.line.employeeId,
        employeeName: row.employeeName,
        employeePin: row.employeePin,
        gross: 0,
        net: 0,
        nssf: 0,
        shif: 0,
        ahl: 0,
        paye: 0,
        otherDeductions: 0,
      });
    }
    const e = empMap.get(row.line.employeeId);
    if (row.line.type === "gross_pay" || (row.line.type === "addition" && row.line.subType === "adjustment")) e.gross += row.line.amountCents;
    if (row.line.type === "net_pay") e.net += row.line.amountCents;
    if (row.line.subType === "NSSF") e.nssf += row.line.amountCents;
    if (row.line.subType === "SHIF") e.shif += row.line.amountCents;
    if (row.line.subType === "AHL") e.ahl += row.line.amountCents;
    if (row.line.subType === "PAYE") e.paye += row.line.amountCents;
    if (row.line.type === "deduction" && !["NSSF", "SHIF", "AHL", "PAYE"].includes(row.line.subType || "")) e.otherDeductions += row.line.amountCents;
  }

  const slipsData = Array.from(empMap.values());

  const totalGross = slipsData.reduce((acc, curr) => acc + curr.gross, 0);
  const totalNet = slipsData.reduce((acc, curr) => acc + curr.net, 0);
  const totalTax = slipsData.reduce((acc, curr) => acc + curr.nssf + curr.shif + curr.ahl + curr.paye + curr.otherDeductions, 0);

  return (
    <>
      <PageHeader 
        title={`Payroll Run: ${run.month}`} 
        subtitle="Review payslips and post to the ledger"
        action={
          run.status === "draft" && (
              <div className="flex items-center gap-3">
                <DeleteRunButton runId={run.id} />
                <PostRunForm 
                  runId={run.id}
                  expenseAccounts={expenseAccounts}
                  liabilityAccounts={liabilityAccounts}
                />
              </div>
          )
        }
      />

      <div className="mt-6">
        <div className="bg-white border border-[var(--color-ink-200)] rounded-xl p-6 flex flex-col md:flex-row justify-between gap-6">
          <div>
            <p className="text-[12px] font-medium text-[var(--color-ink-500)]">Status</p>
            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${run.status === 'posted' ? 'bg-[var(--color-success-50)] text-[var(--color-success-700)] border-[var(--color-success-200)]' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
              {run.status.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--color-ink-500)]">Total Gross Pay</p>
            <p className="text-[16px] font-bold text-[var(--color-ink-900)] mt-1">{fmtKES(totalGross)}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--color-ink-500)]">Total Deductions</p>
            <p className="text-[16px] font-semibold text-[var(--color-error-600)] mt-1">{fmtKES(totalTax)}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[var(--color-ink-500)]">Total Net Pay</p>
            <p className="text-[16px] font-bold text-[var(--color-success-600)] mt-1">{fmtKES(totalNet)}</p>
          </div>
          {run.journalEntryId && (
            <div>
              <p className="text-[12px] font-medium text-[var(--color-ink-500)]">Journal</p>
              <Link href={`/accountant/journal/${run.journalEntryId}`} className="text-[16px] font-bold text-[var(--color-accent-600)] hover:underline mt-1 block">
                #{run.journalEntryId}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <TableCard>
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th right>Gross Pay</Th>
              <Th right>NSSF</Th>
              <Th right>SHIF</Th>
              <Th right>AHL</Th>
              <Th right>PAYE</Th>
              <Th right>Other Ded.</Th>
              <Th right>Net Pay</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {slipsData.map(row => (
              <tr key={row.employeeId}>
                <Td className="font-medium">
                  {row.employeeName}
                  <div className="text-[11px] text-[var(--color-ink-400)] font-normal">{row.employeePin || "No PIN"}</div>
                </Td>
                <Td right>{fmtKES(row.gross)}</Td>
                <Td right className="text-[var(--color-ink-500)]">{fmtKES(row.nssf)}</Td>
                <Td right className="text-[var(--color-ink-500)]">{fmtKES(row.shif)}</Td>
                <Td right className="text-[var(--color-ink-500)]">{fmtKES(row.ahl)}</Td>
                <Td right className="text-[var(--color-ink-500)]">{fmtKES(row.paye)}</Td>
                <Td right className="text-[var(--color-ink-500)]">{fmtKES(row.otherDeductions)}</Td>
                <Td right className="font-semibold text-[var(--color-accent-700)]">{fmtKES(row.net)}</Td>
                <Td right>
                  <a href={`/api/payslip/${run.id}/${row.employeeId}`} target="_blank" className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-ink-600)] bg-white border border-[var(--color-ink-200)] rounded-lg hover:bg-[var(--color-ink-50)] transition-colors">PDF</a>
                </Td>
              </tr>
            ))}
            {slipsData.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-[13px] text-[var(--color-ink-500)]">No payslips found in this run.</td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </div>
    </>
  );
}
