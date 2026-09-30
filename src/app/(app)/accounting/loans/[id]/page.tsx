import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, externalLoanRepayments, externalLoanInterestSchedule } from "@/db";
import { and, eq, desc, asc } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { loanFormOptions, loansWithBalances } from "../data";
import { RepayExternalLoanForm } from "../RepayExternalLoanForm";
import { InterestSetupForm } from "./InterestSetupForm";

export const dynamic = "force-dynamic";

export default async function BusinessLoanDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("accountant");
  const o = await getOrg();
  const { id } = await params;
  const loanId = Number(id);
  const [loans, opts] = await Promise.all([loansWithBalances(o.id), loanFormOptions(o.id)]);
  const loan = loans.find((l) => l.id === loanId);
  if (!loan) notFound();

  const [repayments, schedule] = await Promise.all([
    db
      .select()
      .from(externalLoanRepayments)
      .where(and(eq(externalLoanRepayments.orgId, o.id), eq(externalLoanRepayments.loanId, loanId)))
      .orderBy(desc(externalLoanRepayments.date), desc(externalLoanRepayments.id)),
    db
      .select()
      .from(externalLoanInterestSchedule)
      .where(and(eq(externalLoanInterestSchedule.orgId, o.id), eq(externalLoanInterestSchedule.loanId, loanId)))
      .orderBy(asc(externalLoanInterestSchedule.periodEnd)),
  ]);
  const bankName = new Map(opts.bankAccounts.map((b) => [b.id, b.name]));
  const accName = new Map([...opts.liabilityAccounts, ...opts.interestAccounts].map((a) => [a.id, `${a.code} · ${a.name}`]));

  const facts: [string, string][] = [
    ["Date received", loan.startDate],
    ["Received into", loan.receivedIntoBankAccountId ? bankName.get(loan.receivedIntoBankAccountId) ?? "—" : "Already in the books"],
    ["Term", loan.termMonths ? `${loan.termMonths} months` : "—"],
    ["Monthly installment", loan.monthlyInstallment ? `about ${fmtKES(loan.monthlyInstallment)}` : "—"],
    ["Interest expense account", loan.interestAccountId ? accName.get(loan.interestAccountId) ?? "—" : "—"],
    ["Interest rate", loan.interestRateBp != null ? `${loan.interestRateBp / 100}% p.a.` : "—"],
    ["Reference", loan.reference || "—"],
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={loan.lender} subtitle={loan.status === "active" ? "Business loan · active" : "Business loan · repaid"} />
        {loan.status === "active" && (
          <RepayExternalLoanForm
            loanId={loan.id}
            lender={loan.lender}
            outstandingCents={loan.outstanding}
            suggestedCents={loan.monthlyInstallment}
            bankAccounts={opts.bankAccounts}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          ["Total repayable", loan.totalRepayable, `${fmtKES(loan.principalCents)} + ${fmtKES(loan.interestTotalCents)} interest`],
          ["Paid", loan.paidCents, null],
          ["Outstanding", loan.outstanding, "incl. interest"],
          ["Interest expensed", loan.interestExpensed, loan.interestTotalCents ? `of ${fmtKES(loan.interestTotalCents)}` : null],
        ] as [string, number, string | null][]).map(([label, cents, sub]) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-500)]">{label}</p>
            <p className="text-[18px] font-semibold tnum mt-1">{fmtKES(cents)}</p>
            {sub && <p className="text-[11px] text-[var(--color-ink-400)] mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {loan.status === "active" && loan.interestTotalCents === 0 && (
        <InterestSetupForm
          loanId={loan.id}
          principalCents={loan.principalCents}
          interestAccounts={opts.interestAccounts}
          defaultInterestAccountId={loan.interestAccountId ?? opts.defaultInterestId}
        />
      )}

      <div className="card px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        <div className="flex justify-between gap-4">
          <span className="text-[var(--color-ink-500)]">Loan account</span>
          <Link href={`/accountant/ledger/${loan.liabilityAccountId}`} className="text-right text-[var(--color-accent-600)] hover:underline">
            {accName.get(loan.liabilityAccountId) ?? "View ledger"}
          </Link>
        </div>
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-[var(--color-ink-500)]">{k}</span>
            <span className="text-right">{v}</span>
          </div>
        ))}
        {loan.notes && <p className="sm:col-span-2 text-[var(--color-ink-600)] pt-1">{loan.notes}</p>}
      </div>

      <div>
        <h3 className="text-[14px] font-semibold mb-3">Payments</h3>
        {repayments.length === 0 ? (
          <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No payments recorded yet.</div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Date</Th>
                <Th>Paid from</Th>
                <Th>Reference</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {repayments.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <Td className="text-[var(--color-ink-500)]">{r.date}</Td>
                  <Td>{bankName.get(r.bankAccountId) ?? "—"}</Td>
                  <Td>{r.reference || "—"}</Td>
                  <Td right className="font-medium">{fmtKES(r.amountCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>

      {schedule.length > 0 && (
        <div>
          <h3 className="text-[14px] font-semibold mb-1">Interest schedule</h3>
          <p className="text-[12px] text-[var(--color-ink-500)] mb-3">Each month&apos;s share is expensed automatically at month-end.</p>
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Month</Th>
                <Th right>Interest</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <Td>{r.periodEnd}</Td>
                  <Td right>{fmtKES(r.amountCents)}</Td>
                  <Td className={r.journalEntryId ? "text-[var(--color-good)]" : "text-[var(--color-ink-400)]"}>
                    {r.journalEntryId ? "Expensed" : "Scheduled"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        </div>
      )}
    </div>
  );
}
