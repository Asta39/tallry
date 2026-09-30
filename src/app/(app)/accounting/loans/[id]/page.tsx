import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, externalLoanRepayments } from "@/db";
import { and, eq, desc } from "drizzle-orm";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { loanFormOptions, loansWithBalances } from "../data";
import { RepayExternalLoanForm } from "../RepayExternalLoanForm";

export const dynamic = "force-dynamic";

export default async function BusinessLoanDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("accountant");
  const o = await getOrg();
  const { id } = await params;
  const loanId = Number(id);
  const [loans, opts] = await Promise.all([loansWithBalances(o.id), loanFormOptions(o.id)]);
  const loan = loans.find((l) => l.id === loanId);
  if (!loan) notFound();

  const repayments = await db
    .select()
    .from(externalLoanRepayments)
    .where(and(eq(externalLoanRepayments.orgId, o.id), eq(externalLoanRepayments.loanId, loanId)))
    .orderBy(desc(externalLoanRepayments.date), desc(externalLoanRepayments.id));
  const bankName = new Map(opts.bankAccounts.map((b) => [b.id, b.name]));
  const accName = new Map([...opts.liabilityAccounts, ...opts.interestAccounts].map((a) => [a.id, `${a.code} · ${a.name}`]));

  const facts: [string, string][] = [
    ["Date received", loan.startDate],
    ["Received into", loan.receivedIntoBankAccountId ? bankName.get(loan.receivedIntoBankAccountId) ?? "—" : "Already in the books"],
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
            bankAccounts={opts.bankAccounts}
            interestAccounts={opts.interestAccounts}
            defaultInterestAccountId={loan.interestAccountId ?? opts.defaultInterestId}
          />
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Borrowed", loan.principalCents],
          ["Principal repaid", loan.repaidPrincipal],
          ["Interest paid", loan.paidInterest],
          ["Outstanding", loan.outstanding],
        ].map(([label, cents]) => (
          <div key={label as string} className="card px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-500)]">{label}</p>
            <p className="text-[18px] font-semibold tnum mt-1">{fmtKES(cents as number)}</p>
          </div>
        ))}
      </div>

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
        <h3 className="text-[14px] font-semibold mb-3">Repayments</h3>
        {repayments.length === 0 ? (
          <div className="card px-5 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No repayments recorded yet.</div>
        ) : (
          <TableCard>
            <thead className="hairline-b">
              <tr>
                <Th>Date</Th>
                <Th>Paid from</Th>
                <Th>Reference</Th>
                <Th right>Principal</Th>
                <Th right>Interest &amp; charges</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody>
              {repayments.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <Td className="text-[var(--color-ink-500)]">{r.date}</Td>
                  <Td>{bankName.get(r.bankAccountId) ?? "—"}</Td>
                  <Td>{r.reference || "—"}</Td>
                  <Td right>{fmtKES(r.principalCents)}</Td>
                  <Td right>{fmtKES(r.interestCents)}</Td>
                  <Td right className="font-medium">{fmtKES(r.principalCents + r.interestCents)}</Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </div>
  );
}
