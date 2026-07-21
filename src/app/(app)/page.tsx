import { withOrg, getOrg } from "@/lib/org";
import Link from "next/link";
import { db, documents, todos, events, documentAssignments } from "@/db";
import { desc, asc, inArray, and, eq, exists } from "drizzle-orm";
import { getAccessCached, canViewAllData } from "@/lib/access";
import { dashboardStats, monthlyIncomeExpense, docStatusOverview, memberDashboardStats } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, StatCard, StatusPill, TableCard, Th, Td } from "@/components/ui";
import { IncomeExpenseChart, TodoWidget, CalendarWidget } from "@/components/DashboardWidgets";
import { DocOverview } from "@/components/DocOverview";
import { TimeTrackingCard } from "@/components/TimeTrackingCard";
import { getActiveShift } from "@/lib/time-tracking";

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
  // "Own metrics only": staff with the toggle ON see figures derived solely
  // from documents assigned to them; toggled OFF they see company-wide data.
  // Admin/owner always sees company-wide.
  const ownOnly = !!access && !viewAll && access.perms.has("dashboard_metrics") && !!access.memberId;

  // All independent — fire in parallel
  const [stats, memberStats, chartData, overview, activeShift, recentDocs, todoRows, eventRows] =
    await Promise.all([
      ownOnly ? Promise.resolve(null) : withOrg(() => dashboardStats(today)),
      ownOnly ? withOrg(() => memberDashboardStats(access!.memberId!, today)) : Promise.resolve(null),
      ownOnly ? Promise.resolve([]) : withOrg(() => monthlyIncomeExpense(6)),
      withOrg(() => docStatusOverview(year, ownOnly ? access!.memberId! : undefined)),
      o.timeTrackingEnabled ? getActiveShift() : Promise.resolve(null),
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

      {o.timeTrackingEnabled && (
        <TimeTrackingCard
          initialShift={
            activeShift
              ? {
                  id: activeShift.id,
                  clockInAt: activeShift.clockInAt,
                  clockOutAt: activeShift.clockOutAt,
                  durationSeconds: activeShift.durationSeconds,
                }
              : null
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ownOnly && memberStats ? (
          <>
            <StatCard
              label="Your outstanding invoices"
              hint={memberStats.overdueReceivablesCents > 0
                ? `${fmtKES(memberStats.overdueReceivablesCents)} overdue`
                : "on documents assigned to you"}
              cents={memberStats.receivablesCents}
              tone={memberStats.overdueReceivablesCents > 0 ? "warn" : "neutral"}
            />
            <StatCard label="Overdue" hint="on your invoices" cents={memberStats.overdueReceivablesCents} tone={memberStats.overdueReceivablesCents > 0 ? "warn" : "good"} />
            <StatCard label="Collected this year" hint="payments on your invoices" cents={memberStats.collectedThisYearCents} tone="good" />
            <StatCard label="Your bills to pay" hint="assigned bills & expenses" cents={memberStats.payablesCents} />
          </>
        ) : stats ? (
          <>
            <StatCard label="Cash & M-Pesa" hint="across all money accounts" cents={stats.cashCents} />
            <StatCard
              label="Money you're owed"
              hint={stats.overdueReceivablesCents > 0
                ? `${fmtKES(stats.overdueReceivablesCents)} overdue`
                : "accounts receivable"}
              cents={stats.receivablesCents}
              tone={stats.overdueReceivablesCents > 0 ? "warn" : "neutral"}
            />
            <StatCard label="Money you owe" hint="accounts payable" cents={stats.payablesCents} />
            <StatCard
              label="VAT due to KRA"
              hint="this month so far"
              cents={stats.netVatDueCents}
              tone={stats.netVatDueCents > 0 ? "warn" : "good"}
            />
          </>
        ) : null}
      </div>

      {/* Invoice & quote overview — yearly money breakdown is admin-only */}
      <div className="mt-4">
        <DocOverview data={overview} year={year} years={years} showBreakdown={viewAll} />
      </div>

      {/* Chart (company-wide, hidden in own-metrics view) + calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4 items-stretch">
        {!ownOnly && (
          <div className="lg:col-span-3">
            <IncomeExpenseChart data={chartData} />
          </div>
        )}
        <div className={ownOnly ? "lg:col-span-5" : "lg:col-span-2"}>
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
