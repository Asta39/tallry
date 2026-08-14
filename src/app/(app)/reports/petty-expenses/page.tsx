import { requirePerm } from "@/lib/guard";
import { withOrg } from "@/lib/org";
import { pettyExpenseSummary } from "@/lib/expense-claims";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, TableCard, Th, Td, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "all";

function rangeFor(period: Period, today: string): { from?: string; to?: string } {
  if (period === "all") return {};
  const d = new Date(today + "T00:00:00Z");
  if (period === "day") return { from: today, to: today };
  if (period === "week") {
    // Monday-start week containing today.
    const dow = d.getUTCDay(); // 0 = Sunday
    const back = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - back);
    return { from: monday.toISOString().slice(0, 10), to: today };
  }
  // month
  return { from: today.slice(0, 8) + "01", to: today };
}

export default async function PettyExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePerm("reports");
  const { period: periodParam } = await searchParams;
  const period: Period = periodParam === "day" || periodParam === "week" || periodParam === "month" ? periodParam : "all";

  const range = rangeFor(period, todayISO());
  const { claims, byStaff, byCategory, readyToReimburseCents } = await withOrg(() => pettyExpenseSummary(range));

  const periodLabel: Record<Period, string> = { day: "Today", week: "This week", month: "This month", all: "All time" };
  const tabs: Period[] = ["day", "week", "month", "all"];

  return (
    <>
      <PageHeader
        title="Petty Expenses"
        subtitle="Staff expense claims rolled up by person and category, for easy reimbursement"
      />

      <div className="flex gap-2 mb-6">
        {tabs.map((p) => (
          <a
            key={p}
            href={p === "all" ? "/reports/petty-expenses" : `/reports/petty-expenses?period=${p}`}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
              period === p
                ? "bg-[var(--color-accent-500)] text-white border-[var(--color-accent-500)]"
                : "bg-white text-[var(--color-ink-600)] border-[var(--color-ink-200)] hover:border-[var(--color-ink-400)]"
            }`}
          >
            {periodLabel[p]}
          </a>
        ))}
      </div>

      <div className="card px-5 py-4 mb-6 inline-block">
        <div className="text-[12.5px] text-[var(--color-ink-600)]">Approved, not yet paid out</div>
        <div className={`stat-figure money-lg mt-1 ${readyToReimburseCents > 0 ? "text-[var(--color-bad)]" : ""}`}>
          {fmtKES(readyToReimburseCents)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">By staff member</h2>
          {byStaff.length === 0 ? (
            <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No expense claims yet.</div>
          ) : (
            <TableCard>
              <thead className="hairline-b">
                <tr>
                  <Th>Staff</Th>
                  <Th right>Pending</Th>
                  <Th right>Ready to pay</Th>
                  <Th right>Paid</Th>
                  <Th right>Total</Th>
                </tr>
              </thead>
              <tbody>
                {byStaff.map((s) => (
                  <tr key={s.key} className="hairline-b">
                    <Td>{s.submittedByName}</Td>
                    <Td right>{s.pendingCents ? fmtKES(s.pendingCents) : "—"}</Td>
                    <Td right>
                      <span className={s.approvedUnpaidCents > 0 ? "text-[var(--color-bad)] font-semibold" : ""}>
                        {s.approvedUnpaidCents ? fmtKES(s.approvedUnpaidCents) : "—"}
                      </span>
                    </Td>
                    <Td right>{s.paidCents ? fmtKES(s.paidCents) : "—"}</Td>
                    <Td right className="font-semibold">{fmtKES(s.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>

        <div>
          <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">By category</h2>
          {byCategory.length === 0 ? (
            <div className="card px-6 py-8 text-center text-[13px] text-[var(--color-ink-400)]">No expense claims yet.</div>
          ) : (
            <TableCard>
              <thead className="hairline-b">
                <tr>
                  <Th>Category</Th>
                  <Th right>Claims</Th>
                  <Th right>Total</Th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((c) => (
                  <tr key={c.accountId ?? "uncategorized"} className="hairline-b">
                    <Td>{c.code !== "—" ? `${c.code} · ${c.name}` : c.name}</Td>
                    <Td right>{c.count}</Td>
                    <Td right className="font-semibold">{fmtKES(c.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>

      <h2 className="text-[13px] font-semibold text-[var(--color-ink-600)] mb-3">All claims</h2>
      {claims.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">No expense claims yet.</div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Staff</Th>
              <Th>Category</Th>
              <Th>Description</Th>
              <Th right>Amount</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="hairline-b">
                <Td>{c.date}</Td>
                <Td>{c.submittedByName}</Td>
                <Td>{c.categoryCode ? `${c.categoryCode} · ${c.categoryName}` : c.categoryName ?? "—"}</Td>
                <Td>{c.description}</Td>
                <Td right>{fmtKES(c.amountCents)}</Td>
                <Td><StatusPill status={c.status} /></Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
