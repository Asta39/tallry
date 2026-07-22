import {
  db, documents, documentLines, contacts, items, stockLots,
  expenseClaims, employees, payrollRuns, payrollRunLineItems, timeShifts, deals,
} from "@/db";
import { currentOrgId } from "@/lib/org";
import { and, eq, gte, lte, inArray, sql, desc } from "drizzle-orm";
import { accountBalances, profitAndLoss, cashFlowStatement, vatReturn, aging } from "./reports";

/**
 * Business-owner analytics — all derived from existing ledger/document data,
 * no new source of truth. Every function is org-scoped via currentOrgId()
 * and expects to run inside withOrg(), same convention as reports.ts.
 */

function monthKeys(months: number, offsetYears = 0): { key: string; label: string; from: string; to: string }[] {
  const now = new Date();
  const out: { key: string; label: string; from: string; to: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear() - offsetYears, now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear() - offsetYears, now.getMonth() - i + 1, 0);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: d.toLocaleDateString("en-KE", { month: "short", year: months > 12 ? "2-digit" : undefined }),
      from: `${key}-01`,
      to: nextMonth.toISOString().slice(0, 10),
    });
  }
  return out;
}

/* ---------------- 1. Revenue trend (with YoY) ---------------- */
export async function revenueTrend(months = 12) {
  const thisYear = monthKeys(months, 0);
  const lastYear = monthKeys(months, 1);
  const [cur, prev] = await Promise.all([
    Promise.all(thisYear.map((m) => profitAndLoss(m.from, m.to))),
    Promise.all(lastYear.map((m) => profitAndLoss(m.from, m.to))),
  ]);
  return thisYear.map((m, i) => ({
    label: m.label,
    revenueCents: cur[i].totalIncome,
    revenuePrevYearCents: prev[i].totalIncome,
  }));
}

/* ---------------- 2. Top customers by revenue ---------------- */
export async function topCustomers(limit = 10) {
  const rows = await db
    .select({
      contactId: documents.contactId,
      name: contacts.displayName,
      revenueCents: sql<number>`coalesce(sum(${documents.totalCents} - ${documents.taxCents}), 0)`,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`))
    .groupBy(documents.contactId, contacts.displayName)
    .orderBy(desc(sql`sum(${documents.totalCents} - ${documents.taxCents})`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name || "Walk-in", revenueCents: Number(r.revenueCents) }));
}

/* ---------------- 3. Top items/services ---------------- */
export async function topItems(limit = 10) {
  const rows = await db
    .select({
      itemId: documentLines.itemId,
      name: items.name,
      qty: sql<number>`coalesce(sum(${documentLines.qty}), 0)`,
      revenueCents: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .leftJoin(items, eq(documentLines.itemId, items.id))
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`))
    .groupBy(documentLines.itemId, items.name)
    .orderBy(desc(sql`sum(${documentLines.netCents})`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name || "Unlisted item", qty: Number(r.qty), revenueCents: Number(r.revenueCents) }));
}

/* ---------------- 4. Quote conversion rate ---------------- */
export async function quoteConversion(months = 6) {
  const range = monthKeys(months);
  const rows = await db
    .select({
      month: sql<string>`substr(${documents.date}, 1, 7)`,
      status: documents.status,
      count: sql<number>`count(*)`,
    })
    .from(documents)
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "quote"), gte(documents.date, range[0].from)))
    .groupBy(sql`substr(${documents.date}, 1, 7)`, documents.status);

  const series = range.map((m) => {
    const inMonth = rows.filter((r) => r.month === m.key);
    const total = inMonth.reduce((s, r) => s + Number(r.count), 0);
    const accepted = inMonth.find((r) => r.status === "accepted")?.count || 0;
    return { label: m.label, rate: total > 0 ? Math.round((Number(accepted) / total) * 100) : 0, total, accepted: Number(accepted) };
  });
  const totalAll = series.reduce((s, m) => s + m.total, 0);
  const acceptedAll = series.reduce((s, m) => s + m.accepted, 0);
  return { series, overallRate: totalAll > 0 ? Math.round((acceptedAll / totalAll) * 100) : 0, totalAll, acceptedAll };
}

/* ---------------- 6. Cash flow trend ---------------- */
export async function cashFlowTrend(months = 12) {
  const range = monthKeys(months);
  const series = await Promise.all(range.map((m) => cashFlowStatement(m.from, m.to)));
  return range.map((m, i) => ({ label: m.label, netChangeCents: series[i].netChangeActual, netOpCents: series[i].netOp }));
}

/* ---------------- 7. DSO (Days Sales Outstanding) ---------------- */
export async function dso(): Promise<{ days: number; arCents: number; trailingRevenueCents: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const start90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [arAging, pl] = await Promise.all([
    aging("invoice", today),
    profitAndLoss(start90, today),
  ]);
  const dailyRevenue = pl.totalIncome / 90;
  const days = dailyRevenue > 0 ? Math.round(arAging.total / dailyRevenue) : 0;
  return { days, arCents: arAging.total, trailingRevenueCents: pl.totalIncome };
}

/* ---------------- 8. Bank balance trend ---------------- */
export async function bankBalanceTrend(months = 12) {
  const range = monthKeys(months);
  const balances = await Promise.all(range.map((m) => accountBalances({ to: m.to })));
  return range.map((m, i) => {
    const cash = balances[i].filter((b) => b.subtype === "bank" || b.subtype === "cash");
    return { label: m.label, balanceCents: cash.reduce((s, b) => s + b.balanceCents, 0) };
  });
}

/* ---------------- 9. Expense breakdown by category ---------------- */
export async function expenseBreakdown(months = 12) {
  const range = monthKeys(months);
  const balances = await accountBalances({ from: range[0].from, to: range[range.length - 1].to });
  const expenseAccounts = balances.filter((b) => b.type === "expense" && b.balanceCents > 0).sort((a, b) => b.balanceCents - a.balanceCents);
  const top = expenseAccounts.slice(0, 7);
  const rest = expenseAccounts.slice(7);
  const otherCents = rest.reduce((s, b) => s + b.balanceCents, 0);
  const out = top.map((b) => ({ name: b.name, amountCents: b.balanceCents }));
  if (otherCents > 0) out.push({ name: "Other", amountCents: otherCents });
  return out;
}

/* ---------------- 10. Top vendors by spend ---------------- */
export async function topVendors(limit = 10) {
  const rows = await db
    .select({
      contactId: documents.contactId,
      name: contacts.displayName,
      spendCents: sql<number>`coalesce(sum(${documents.totalCents}), 0)`,
    })
    .from(documents)
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "bill"), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`))
    .groupBy(documents.contactId, contacts.displayName)
    .orderBy(desc(sql`sum(${documents.totalCents})`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name || "Unknown vendor", spendCents: Number(r.spendCents) }));
}

/* ---------------- 12. Expense claims stats ---------------- */
export async function expenseClaimsStats() {
  const rows = await db.select().from(expenseClaims).where(eq(expenseClaims.orgId, currentOrgId()));
  const byStatus = { pending: 0, approved: 0, rejected: 0, paid: 0 };
  let approvalDaysSum = 0;
  let approvalCount = 0;
  for (const c of rows) {
    if (c.status in byStatus) byStatus[c.status as keyof typeof byStatus]++;
    if (c.reviewedAt) {
      approvalDaysSum += (new Date(c.reviewedAt).getTime() - new Date(c.createdAt).getTime()) / 86400000;
      approvalCount++;
    }
  }
  return {
    byStatus,
    total: rows.length,
    avgApprovalDays: approvalCount > 0 ? Math.round((approvalDaysSum / approvalCount) * 10) / 10 : null,
  };
}

/* ---------------- 13. Margin trend ---------------- */
export async function marginTrend(months = 12) {
  const range = monthKeys(months);
  const series = await Promise.all(range.map((m) => profitAndLoss(m.from, m.to)));
  return range.map((m, i) => {
    const pl = series[i];
    return {
      label: m.label,
      grossMarginPct: pl.totalIncome > 0 ? Math.round((pl.grossProfit / pl.totalIncome) * 1000) / 10 : 0,
      netMarginPct: pl.totalIncome > 0 ? Math.round((pl.netProfit / pl.totalIncome) * 1000) / 10 : 0,
    };
  });
}

/* ---------------- 15. Profitability by customer ---------------- */
export async function profitabilityByCustomer(limit = 15) {
  const rows = await db
    .select({
      contactId: documents.contactId,
      name: contacts.displayName,
      revenueCents: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
      cogsCents: sql<number>`coalesce(sum(${documentLines.cogsCents}), 0)`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .leftJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`))
    .groupBy(documents.contactId, contacts.displayName)
    .orderBy(desc(sql`sum(${documentLines.netCents}) - sum(${documentLines.cogsCents})`))
    .limit(limit);
  return rows.map((r) => {
    const revenue = Number(r.revenueCents);
    const cogs = Number(r.cogsCents);
    const profit = revenue - cogs;
    return { name: r.name || "Walk-in", revenueCents: revenue, profitCents: profit, marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0 };
  });
}

/* ---------------- 16. Stock value snapshot (current, by item) ---------------- */
export async function stockValueByItem(limit = 10) {
  const rows = await db
    .select({
      itemId: stockLots.itemId,
      name: items.name,
      qty: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)`,
      valueCents: sql<number>`coalesce(sum(${stockLots.remainingQty} * ${stockLots.unitCostCents}), 0)`,
    })
    .from(stockLots)
    .innerJoin(items, eq(stockLots.itemId, items.id))
    .where(and(eq(stockLots.orgId, currentOrgId()), sql`${stockLots.remainingQty} > 0`))
    .groupBy(stockLots.itemId, items.name)
    .orderBy(desc(sql`sum(${stockLots.remainingQty} * ${stockLots.unitCostCents})`))
    .limit(limit);
  const total = rows.reduce((s, r) => s + Number(r.valueCents), 0);
  return { rows: rows.map((r) => ({ name: r.name, qty: Number(r.qty), valueCents: Number(r.valueCents) })), totalCents: total };
}

/* ---------------- 17. Fast/slow movers ---------------- */
export async function fastSlowMovers(limit = 10) {
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [sold, stock] = await Promise.all([
    db.select({
      itemId: documentLines.itemId,
      qtySold: sql<number>`coalesce(sum(${documentLines.qty}), 0)`,
    })
      .from(documentLines)
      .innerJoin(documents, eq(documentLines.documentId, documents.id))
      .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), gte(documents.date, since), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`))
      .groupBy(documentLines.itemId),
    db.select({
      itemId: stockLots.itemId,
      name: items.name,
      qtyOnHand: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)`,
    })
      .from(stockLots)
      .innerJoin(items, eq(stockLots.itemId, items.id))
      .where(and(eq(stockLots.orgId, currentOrgId()), sql`${stockLots.remainingQty} > 0`))
      .groupBy(stockLots.itemId, items.name),
  ]);
  const soldMap = new Map(sold.map((s) => [s.itemId, Number(s.qtySold)]));
  const withTurnover = stock.map((s) => {
    const qtySold90d = soldMap.get(s.itemId) || 0;
    const qtyOnHand = Number(s.qtyOnHand);
    return { name: s.name, qtyOnHand, qtySold90d, turnover: qtyOnHand > 0 ? Math.round((qtySold90d / qtyOnHand) * 100) / 100 : qtySold90d > 0 ? Infinity : 0 };
  });
  const sorted = [...withTurnover].sort((a, b) => b.turnover - a.turnover);
  return { fastest: sorted.slice(0, limit), slowest: sorted.slice(-limit).reverse() };
}

/* ---------------- 18. Dead stock ---------------- */
export async function deadStock(days = 60, limit = 15) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const [stock, recentSales] = await Promise.all([
    db.select({
      itemId: stockLots.itemId,
      name: items.name,
      qtyOnHand: sql<number>`coalesce(sum(${stockLots.remainingQty}), 0)`,
      valueCents: sql<number>`coalesce(sum(${stockLots.remainingQty} * ${stockLots.unitCostCents}), 0)`,
    })
      .from(stockLots)
      .innerJoin(items, eq(stockLots.itemId, items.id))
      .where(and(eq(stockLots.orgId, currentOrgId()), sql`${stockLots.remainingQty} > 0`))
      .groupBy(stockLots.itemId, items.name),
    db.selectDistinct({ itemId: documentLines.itemId })
      .from(documentLines)
      .innerJoin(documents, eq(documentLines.documentId, documents.id))
      .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), gte(documents.date, since))),
  ]);
  const soldRecently = new Set(recentSales.map((r) => r.itemId));
  return stock
    .filter((s) => !soldRecently.has(s.itemId))
    .map((s) => ({ name: s.name, qtyOnHand: Number(s.qtyOnHand), valueCents: Number(s.valueCents) }))
    .sort((a, b) => b.valueCents - a.valueCents)
    .slice(0, limit);
}

/* ---------------- 19. Payroll cost trend ---------------- */
export async function payrollCostTrend(months = 12) {
  const range = monthKeys(months);
  const rows = await db
    .select({
      month: payrollRuns.month,
      grossCents: sql<number>`coalesce(sum(${payrollRunLineItems.amountCents}), 0)`,
    })
    .from(payrollRunLineItems)
    .innerJoin(payrollRuns, eq(payrollRunLineItems.payrollRunId, payrollRuns.id))
    .where(and(eq(payrollRuns.orgId, currentOrgId()), eq(payrollRunLineItems.type, "gross_pay"), eq(payrollRuns.status, "posted")))
    .groupBy(payrollRuns.month);
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.grossCents)]));
  return range.map((m) => ({ label: m.label, grossCents: byMonth.get(m.key) || 0 }));
}

/* ---------------- 20. New hires per month (headcount proxy) ---------------- */
export async function newHiresTrend(months = 12) {
  const range = monthKeys(months);
  const rows = await db
    .select({ month: sql<string>`substr(${employees.createdAt}, 1, 7)`, count: sql<number>`count(*)` })
    .from(employees)
    .where(eq(employees.orgId, currentOrgId()))
    .groupBy(sql`substr(${employees.createdAt}, 1, 7)`);
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.count)]));
  const [activeCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(and(eq(employees.orgId, currentOrgId()), eq(employees.isActive, true)));
  return { series: range.map((m) => ({ label: m.label, hires: byMonth.get(m.key) || 0 })), activeHeadcount: Number(activeCount.count) };
}

/* ---------------- 21. Time tracking hours per staff (last N weeks) ---------------- */
export async function timeTrackingHours(weeks = 8) {
  const since = new Date(Date.now() - weeks * 7 * 86400000).toISOString();
  const rows = await db.select().from(timeShifts).where(and(eq(timeShifts.orgId, currentOrgId()), gte(timeShifts.clockInAt, since)));
  const byPerson = new Map<string, number>();
  for (const r of rows) {
    if (!r.durationSeconds) continue;
    byPerson.set(r.personName, (byPerson.get(r.personName) || 0) + r.durationSeconds);
  }
  return Array.from(byPerson.entries())
    .map(([name, seconds]) => ({ name, hours: Math.round((seconds / 3600) * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);
}

/* ---------------- 22 & 23. Pipeline by stage + win rate ---------------- */
export async function pipelineByStage() {
  const rows = await db
    .select({ stage: deals.stage, count: sql<number>`count(*)`, valueCents: sql<number>`coalesce(sum(${deals.amountCents}), 0)` })
    .from(deals)
    .where(eq(deals.orgId, currentOrgId()))
    .groupBy(deals.stage);
  const order = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
  const byStage = new Map(rows.map((r) => [r.stage, { count: Number(r.count), valueCents: Number(r.valueCents) }]));
  const stages = order.map((s) => ({ stage: s, ...(byStage.get(s) || { count: 0, valueCents: 0 }) }));
  const won = byStage.get("won")?.count || 0;
  const lost = byStage.get("lost")?.count || 0;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  return { stages, winRate, won, lost };
}

/* ---------------- 24. New vs returning customers ---------------- */
export async function newVsReturningCustomers(months = 12) {
  const range = monthKeys(months);
  const rows = await db
    .select({ contactId: documents.contactId, date: documents.date })
    .from(documents)
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, "invoice"), sql`${documents.status} != 'draft' AND ${documents.status} != 'void'`));
  const firstInvoiceByContact = new Map<number, string>();
  for (const r of rows) {
    if (!r.contactId) continue;
    const existing = firstInvoiceByContact.get(r.contactId);
    if (!existing || r.date < existing) firstInvoiceByContact.set(r.contactId, r.date);
  }
  return range.map((m) => {
    let newCount = 0;
    let returningCount = 0;
    const seenThisMonth = new Set<number>();
    for (const r of rows) {
      if (!r.contactId) continue;
      const month = r.date.slice(0, 7);
      if (month !== m.key || seenThisMonth.has(r.contactId)) continue;
      seenThisMonth.add(r.contactId);
      const first = firstInvoiceByContact.get(r.contactId);
      if (first && first.slice(0, 7) === m.key) newCount++;
      else returningCount++;
    }
    return { label: m.label, newCustomers: newCount, returningCustomers: returningCount };
  });
}

/* ---------------- 25. VAT position trend ---------------- */
export async function vatPositionTrend(months = 12) {
  const range = monthKeys(months);
  const series = await Promise.all(range.map((m) => vatReturn(m.from, m.to)));
  return range.map((m, i) => ({ label: m.label, netVatDueCents: series[i].netVatDue, outputVat: series[i].outputVat, inputVat: series[i].inputVat }));
}

/* ---------------- 26. Books health ---------------- */
export async function booksHealth(orgLockDate: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  const balances = await accountBalances({ to: today });
  const totalDr = balances.reduce((s, b) => s + b.debitCents, 0);
  const totalCr = balances.reduce((s, b) => s + b.creditCents, 0);
  const [lastRecon] = await db.execute<{ completed_at: string }>(sql`
    select completed_at from bank_reconciliations
    where org_id = ${currentOrgId()} and status = 'completed'
    order by completed_at desc limit 1
  `).then((r: any) => r.rows ?? r);
  return {
    balanced: totalDr === totalCr,
    totalDr,
    totalCr,
    lastReconciliationDate: lastRecon?.completed_at?.slice(0, 10) || null,
    lockDate: orgLockDate,
  };
}
