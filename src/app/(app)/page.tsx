import { withOrg, getOrg } from "@/lib/org";
import Link from "next/link";
import { db, documents, todos, events } from "@/db";
import { desc, asc, inArray, and, eq } from "drizzle-orm";
import { dashboardStats, monthlyIncomeExpense } from "@/lib/reports";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, StatCard, StatusPill, TableCard, Th, Td } from "@/components/ui";
import { IncomeExpenseChart, TodoWidget, CalendarWidget } from "@/components/DashboardWidgets";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const o = await getOrg();
  const today = todayISO();
  const stats = await withOrg(() => dashboardStats(today));
  const chartData = await withOrg(() => monthlyIncomeExpense(6));

  const recentDocs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, o.id), inArray(documents.type, ["invoice", "bill", "expense"])))
    .orderBy(desc(documents.createdAt))
    .limit(8);

  const todoRows = await db
    .select()
    .from(todos)
    .where(eq(todos.orgId, o.id))
    .orderBy(asc(todos.done), desc(todos.id))
    .limit(30);

  const eventRows = await db.select().from(events).where(eq(events.orgId, o.id));

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${o?.name ?? "there"}`}
        subtitle={new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cash & M-Pesa" hint="across all money accounts" cents={stats.cashCents} />
        <StatCard
          label="Money you're owed"
          hint={
            stats.overdueReceivablesCents > 0
              ? `${fmtKES(stats.overdueReceivablesCents)} overdue`
              : "accounts receivable"
          }
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
      </div>

      {/* Chart + calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-4 items-start">
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
