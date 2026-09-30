import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { PageHeader, TableCard, Th, Td, PrimaryLink } from "@/components/ui";
import { fmtKES } from "@/lib/money";
import { loanFormOptions, loansWithBalances, liabilityBalances } from "./data";
import { RepayExternalLoanForm } from "./RepayExternalLoanForm";

export const dynamic = "force-dynamic";

export default async function BusinessLoansPage() {
  await requirePerm("accountant");
  const o = await getOrg();
  const [loans, opts] = await Promise.all([loansWithBalances(o.id), loanFormOptions(o.id)]);
  const accName = new Map(opts.liabilityAccounts.map((a) => [a.id, `${a.code} · ${a.name}`]));

  // Loan accounts carrying a balance the register doesn't account for — e.g.
  // loans entered by hand as an opening balance or manual journal before this
  // page existed. They can't be repaid here until they're registered.
  const loanAccountIds = Array.from(
    new Set([
      ...loans.map((l) => l.liabilityAccountId),
      ...opts.liabilityAccounts.filter((a) => /loan|credit facilit|borrow/i.test(a.name)).map((a) => a.id),
    ])
  );
  const ledger = await liabilityBalances(o.id, loanAccountIds);
  const unregistered = loanAccountIds
    .map((id) => {
      const registered = loans.filter((l) => l.liabilityAccountId === id).reduce((s, l) => s + l.outstanding, 0);
      return { id, name: accName.get(id) ?? "Loan account", gap: (ledger.get(id) ?? 0) - registered };
    })
    .filter((r) => r.gap > 0);

  return (
    <>
      <PageHeader
        title="Business Loans"
        subtitle="Money the business has borrowed (bank, SACCO, M-Pesa loan, asset finance, director) and its repayments"
        action={<PrimaryLink href="/accounting/loans/new">+ Record a loan</PrimaryLink>}
      />

      {unregistered.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3.5 mb-5 text-[12.5px] text-amber-900">
          {unregistered.map((r) => (
            <p key={r.id}>
              <strong>{fmtKES(r.gap)}</strong> on {r.name} isn&apos;t registered as a loan here yet. To repay it, record each loan with
              &ldquo;Already in the books&rdquo; — that registers it without posting it twice.
            </p>
          ))}
        </div>
      )}

      {loans.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No business loans recorded yet.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Lender</Th>
              <Th right>Borrowed</Th>
              <Th right>Interest</Th>
              <Th right>Total repayable</Th>
              <Th right>Paid</Th>
              <Th right>Outstanding</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="hairline-t hover:bg-[var(--color-ink-50)]/60">
                <Td className="font-medium">
                  <Link href={`/accounting/loans/${l.id}`} className="text-[var(--color-accent-600)] hover:underline">
                    {l.lender}
                  </Link>
                  <span className="block text-[11px] text-[var(--color-ink-400)]">
                    {[accName.get(l.liabilityAccountId), l.termMonths ? `${l.termMonths} months` : null, l.reference].filter(Boolean).join(" · ")}
                  </span>
                </Td>
                <Td right>{fmtKES(l.principalCents)}</Td>
                <Td right>{l.interestTotalCents ? fmtKES(l.interestTotalCents) : "—"}</Td>
                <Td right>{fmtKES(l.totalRepayable)}</Td>
                <Td right>{fmtKES(l.paidCents)}</Td>
                <Td right className="font-semibold">{fmtKES(l.outstanding)}</Td>
                <Td>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${l.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-[var(--color-ink-100)] text-[var(--color-ink-400)]"}`}>
                    {l.status === "active" ? "active" : "repaid"}
                  </span>
                </Td>
                <Td right>
                  {l.status === "active" && (
                    <RepayExternalLoanForm
                      compact
                      loanId={l.id}
                      lender={l.lender}
                      outstandingCents={l.outstanding}
                      suggestedCents={l.monthlyInstallment}
                      bankAccounts={opts.bankAccounts}
                    />
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
