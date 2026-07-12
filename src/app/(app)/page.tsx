import { withOrg, getOrg } from "@/lib/org";
import Link from "next/link";
import { db, documents, todos, events, documentAssignments } from "@/db";
import { desc, asc, inArray, and, eq, exists } from "drizzle-orm";
import { getAccessCached, canViewAllData } from "@/lib/access";
import { dashboardStats, monthlyIncomeExpense, docStatusOverview } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, StatCard, StatusPill, TableCard, Th, Td } from "@/components/ui";
import { IncomeExpenseChart, TodoWidget, CalendarWidget } from "@/components/DashboardWidgets";
import { DocOverview } from "@/components/DocOverview";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const o = await getOrg();
  const today = todayISO();
  const thisYear = today.slice(0, 4);
  const { year: yearParam } = await searchParams;
  const year = /^\d{4}$/.test(yearParam ?? "") ? yearParam! : thisYear;

  const access = await getAccessCached();
  const viewAll = access ? canViewAllData(access) : true;
  const viewMetrics = access ? (viewAll || access.perms.has("dashboard_metrics")) : true;

  // All independent — fire in parallel
  const [stats, chartData, overview, recentDocs, todoRows, eventRows] =
    await Promise.all([
      viewMetrics ? withOrg(() => dashboardStats(today)) : Promise.resolve({
        cashCents: 0, receivablesCents: 0, overdueReceivablesCents: 0, payablesCents: 0,
        incomeThisMonthCents: 0, expensesThisMonthCents: 0, netVatDueCents: 0
      }),
      viewMetrics ? withOrg(() => monthlyIncomeExpense(6)) : Promise.resolve([]),
      viewMetrics ? withOrg(() => docStatusOverview(year)) : Promise.resolve({ 
        inv: { draft: 0, open: 0, partial: 0, overdue: 0, paid: 0, void: 0 }, 
        invTotal: 0, 
        qt: { draft: 0, open: 0, accepted: 0, declined: 0 }, 
        qtTotal: 0, 
        outstandingCents: 0, 
        pastDueCents: 0, 
        paidCents: 0 
      }),
      db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.orgId, o.id), 
            inArray(documents.type, ["invoice", "bill", "expense"]),
            viewAll ? undefined : exists(
              db.select().from(documentAssignments)
              .where(and(
                eq(documentAssignments.documentId, documents.id),
                eq(documentAssignments.memberId, access!.memberId!)
              ))
            )
          )
        )
        .orderBy(desc(documents.createdAt))
        .limit(8),
      db
        .select()
        .from(todos)
        .where(eq(todos.orgId, o.id))
        .orderBy(asc(todos.done), desc(todos.id))
        .limit(30),
      db.select().from(events).where(eq(events.orgId, o.id)),
    ]);

  const years = [thisYear, String(Number(thisYear) - 1), String(Number(thisYear) - 2)];

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${o?.name ?? "there"}`}
        subtitle={new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cash & M-Pesa" hint="across all money accounts" cents={viewMetrics ? stats.cashCents : undefined} emptyHint={!viewMetrics ? "Hidden (restricted)" : undefined} />
        <StatCard
          label="Money you're owed"
          hint={
            !viewMetrics ? "Hidden (restricted)" :
            stats.overdueReceivablesCents > 0
              ? `${fmtKES(stats.overdueReceivablesCents)} overdue`
              : "accounts receivable"
          }
          cents={viewMetrics ? stats.receivablesCents : undefined}
          tone={viewMetrics && stats.overdueReceivablesCents > 0 ? "warn" : "neutral"}
        />
        <StatCard label="Money you owe" hint={!viewMetrics ? "Hidden (restricted)" : "accounts payable"} cents={viewMetrics ? stats.payablesCents : undefined} />
        <StatCard
          label="VAT due to KRA"
          hint={!viewMetrics ? "Hidden (restricted)" : "this month so far"}
          cents={viewMetrics ? stats.netVatDueCents : undefined}
          tone={viewMetrics && stats.netVatDueCents > 0 ? "warn" : "good"}
        />
      </div>

      {/* Invoice & quote overview */}
      <div className="mt-4">
        <DocOverview data={overview} year={year} years={years} />
      </div>

      {/* Chart + calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4 items-stretch">
        <div className="lg:col-span-3">
          <IncomeExpenseChart data={chartData} />
        </div>
        <div className="lg:col-span-2">
          <CalendarWidget
            events={eventRows.map((e) => ({ id: e.id, title: e.title, date: e.date, color: e.color }))}
          />
        </div>
      </div>

      {/* Todos + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4 items-start">
        <div className="lg:col-span-2">
          <TodoWidget
            todos={todoRows.map((t) => ({ id: t.id, title: t.title, done: t.done, dueDate: t.dueDate }))}
          />
        </div>
        <div className="lg:col-span-3">
          <h2 className="text-[15px] font-semibold mb-3">Recent activity</h2>
          {recentDocs.length === 0 ? (
            <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
              No transactions yet. Create your first{" "}
              <Link href="/sales/invoices/new" className="text-[var(--color-accent-600)] font-medium">
                invoice
              </Link>{" "}
              to get going.
            </div>
          ) : (
            <TableCard>
              <thead className="hairline-b">
                <tr>
                  <Th>Date</Th>
                  <Th>Document</Th>
                  <Th>Status</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map((d) => (
                  <tr key={d.id} className="hairline-t">
                    <Td className="text-[var(--color-ink-400)]">{d.date}</Td>
                    <Td>
                      <Link href={docHref(d.type, d.id)} className="font-medium hover:text-[var(--color-accent-600)]">
                        {typeLabel(d.type)} {d.number}
                      </Link>
                    </Td>
                    <Td>
                      <StatusPill status={d.status} overdue={isOverdue(d.status, d.dueDate, today)} />
                    </Td>
                    <Td right>{fmtKES(d.totalCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function typeLabel(t: string) {
  return { invoice: "Invoice", bill: "Bill", expense: "Expense", quote: "Quote", credit_note: "Credit note" }[t] ?? t;
}

function docHref(type: string, id: number) {
  if (type === "invoice") return `/sales/invoices/${id}`;
  if (type === "bill") return `/purchases/bills/${id}`;
  return `/purchases/expenses/${id}`;
}

function isOverdue(status: string, dueDate: string | null, today: string) {
  return status === "open" && !!dueDate && dueDate < today;
}
