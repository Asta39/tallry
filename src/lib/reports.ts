import { db, accounts, journalEntries, journalLines, documents } from "@/db";
import { currentOrgId } from "@/lib/org";
import { and, eq, gte, lte, inArray, sql, ne } from "drizzle-orm";

/**
 * Reporting queries — all derived from the ledger (journal lines), never from
 * document totals, so reports always reconcile.
 */

export interface AccountBalance {
  accountId: number;
  code: string;
  name: string;
  type: string;
  subtype: string;
  /** signed natural balance: assets/expenses positive when debit-heavy, etc. */
  balanceCents: number;
  debitCents: number;
  creditCents: number;
}

export async function accountBalances(opts?: { from?: string; to?: string }): Promise<AccountBalance[]> {
  const conds = [eq(journalLines.orgId, currentOrgId())] as ReturnType<typeof eq>[];
  if (opts?.from) conds.push(gte(journalEntries.date, opts.from));
  if (opts?.to) conds.push(lte(journalEntries.date, opts.to));

  const rows = await db
    .select({
      accountId: journalLines.accountId,
      debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(journalLines.accountId);

  const allAccounts = await db.select().from(accounts).where(eq(accounts.orgId, currentOrgId()));
  const byId = new Map(allAccounts.map((a) => [a.id, a]));

  return rows
    .map((r) => {
      const a = byId.get(r.accountId)!;
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      const debitNature = a.type === "asset" || a.type === "expense";
      const balance = debitNature ? debit - credit : credit - debit;
      return {
        accountId: r.accountId,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        balanceCents: balance,
        debitCents: debit,
        creditCents: credit,
      };
    })
    .sort((x, y) => x.code.localeCompare(y.code));
}

export async function profitAndLoss(from: string, to: string) {
  const balances = await accountBalances({ from, to });
  const income = balances.filter((b) => b.type === "income");
  const cogs = balances.filter((b) => b.type === "expense" && b.subtype === "cost_of_goods_sold");
  const expenses = balances.filter((b) => b.type === "expense" && b.subtype !== "cost_of_goods_sold");
  const totalIncome = income.reduce((s, b) => s + b.balanceCents, 0);
  const totalCogs = cogs.reduce((s, b) => s + b.balanceCents, 0);
  const totalExpenses = expenses.reduce((s, b) => s + b.balanceCents, 0);
  return {
    income,
    cogs,
    expenses,
    totalIncome,
    totalCogs,
    grossProfit: totalIncome - totalCogs,
    totalExpenses,
    netProfit: totalIncome - totalCogs - totalExpenses,
  };
}

export async function balanceSheet(asOf: string) {
  const balances = await accountBalances({ to: asOf });
  const assets = balances.filter((b) => b.type === "asset" && b.balanceCents !== 0);
  const liabilities = balances.filter((b) => b.type === "liability" && b.balanceCents !== 0);
  const equity = balances.filter((b) => b.type === "equity" && b.balanceCents !== 0);
  // Current-period earnings folded into equity so the sheet balances
  const pl = await profitAndLoss("0000-01-01", asOf);
  const totalAssets = assets.reduce((s, b) => s + b.balanceCents, 0);
  const totalLiabilities = liabilities.reduce((s, b) => s + b.balanceCents, 0);
  const totalEquityAccounts = equity.reduce((s, b) => s + b.balanceCents, 0);
  return {
    assets,
    liabilities,
    equity,
    currentEarningsCents: pl.netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity: totalEquityAccounts + pl.netProfit,
  };
}

/** VAT return prep: output VAT (sales) vs input VAT (purchases) from document lines. */
export async function vatReturn(from: string, to: string) {
  const salesDocs = ["invoice", "credit_note"];
  const purchaseDocs = ["bill", "expense"];

  const rows = await db
    .select({
      type: documents.type,
      taxClass: sql<string>`dl.tax_class`,
      net: sql<number>`sum(dl.net_cents)`,
      tax: sql<number>`sum(dl.tax_cents)`,
    })
    .from(documents)
    .innerJoin(sql`document_lines dl`, sql`dl.document_id = ${documents.id}`)
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        gte(documents.date, from),
        lte(documents.date, to),
        ne(documents.status, "draft"),
        ne(documents.status, "void"),
        inArray(documents.type, [...salesDocs, ...purchaseDocs])
      )
    )
    .groupBy(documents.type, sql`dl.tax_class`);

  const empty = () => ({
    B16: { net: 0, tax: 0 },
    C0: { net: 0, tax: 0 },
    A_EXEMPT: { net: 0, tax: 0 },
    D_NONVAT: { net: 0, tax: 0 },
  });
  const sales = empty();
  const purchases = empty();
  for (const r of rows) {
    const sign = r.type === "credit_note" ? -1 : 1;
    const target = salesDocs.includes(r.type) ? sales : purchases;
    const bucket = target[r.taxClass as keyof ReturnType<typeof empty>];
    if (bucket) {
      bucket.net += sign * Number(r.net);
      bucket.tax += sign * Number(r.tax);
    }
  }
  const outputVat = sales.B16.tax;
  const inputVat = purchases.B16.tax;
  return { sales, purchases, outputVat, inputVat, netVatDue: outputVat - inputVat };
}

/** AR/AP aging buckets from open documents. */
export async function aging(type: "invoice" | "bill", asOf: string) {
  const docs = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, currentOrgId()), eq(documents.type, type), inArray(documents.status, ["open", "partial"])));
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
  const rows = docs.map((d) => {
    const due = d.dueDate ?? d.date;
    const days = Math.floor((Date.parse(asOf) - Date.parse(due)) / 86_400_000);
    const balance = d.totalCents - d.paidCents;
    const bucket =
      days <= 0 ? "current" : days <= 30 ? "d1_30" : days <= 60 ? "d31_60" : days <= 90 ? "d61_90" : "d90plus";
    buckets[bucket] += balance;
    return { ...d, balanceCents: balance, daysOverdue: Math.max(0, days), bucket };
  });
  return { rows, buckets, total: Object.values(buckets).reduce((a, b) => a + b, 0) };
}

/** Dashboard rollups. */
export async function dashboardStats(today: string) {
  const monthStart = today.slice(0, 8) + "01";

  // All independent — run in parallel
  const [openInvoices, openBills, allBalances, pl, vat] = await Promise.all([
    aging("invoice", today),
    aging("bill", today),
    accountBalances({ to: today }),
    profitAndLoss(monthStart, today),
    vatReturn(monthStart, today),
  ]);

  const cash = allBalances.filter(
    (b) => b.subtype === "bank" || b.subtype === "cash"
  );

  return {
    receivablesCents: openInvoices.total,
    overdueReceivablesCents:
      openInvoices.buckets.d1_30 +
      openInvoices.buckets.d31_60 +
      openInvoices.buckets.d61_90 +
      openInvoices.buckets.d90plus,
    payablesCents: openBills.total,
    cashCents: cash.reduce((s, b) => s + b.balanceCents, 0),
    cashAccounts: cash,
    incomeThisMonthCents: pl.totalIncome,
    expensesThisMonthCents: pl.totalCogs + pl.totalExpenses,
    netVatDueCents: vat.netVatDue,
  };
}

export async function generalLedger(accountId: number, from?: string, to?: string) {
  const conds = [eq(journalLines.orgId, currentOrgId()), eq(journalLines.accountId, accountId)];
  if (from) conds.push(gte(journalEntries.date, from));
  if (to) conds.push(lte(journalEntries.date, to));
  return db
    .select({
      date: journalEntries.date,
      memo: journalEntries.memo,
      sourceType: journalEntries.sourceType,
      entryId: journalEntries.id,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
      lineMemo: journalLines.memo,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(...conds))
    .orderBy(journalEntries.date, journalEntries.id);
}

/** Income vs expense per month for the dashboard chart (last n months, oldest first). */
export async function monthlyIncomeExpense(months = 6): Promise<
  { month: string; label: string; incomeCents: number; expenseCents: number }[]
> {
  const rows = await db
    .select({
      month: sql<string>`substr(${journalEntries.date}, 1, 7)`,
      type: accounts.type,
      debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(eq(journalLines.orgId, currentOrgId()), inArray(accounts.type, ["income", "expense"])))
    .groupBy(sql`substr(${journalEntries.date}, 1, 7)`, accounts.type);

  const now = new Date();
  const out: { month: string; label: string; incomeCents: number; expenseCents: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-KE", { month: "short" });
    const income = rows.filter((r) => r.month === key && r.type === "income")
      .reduce((s, r) => s + Number(r.credit) - Number(r.debit), 0);
    const expense = rows.filter((r) => r.month === key && r.type === "expense")
      .reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
    out.push({ month: key, label, incomeCents: Math.max(0, income), expenseCents: Math.max(0, expense) });
  }
  return out;
}

/** Invoice/quote status breakdown + money totals for a year (dashboard overview). */
export async function docStatusOverview(year: string) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const today = new Date().toISOString().slice(0, 10);
  const docs = await db
    .select({
      type: documents.type,
      status: documents.status,
      dueDate: documents.dueDate,
      totalCents: documents.totalCents,
      paidCents: documents.paidCents,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        gte(documents.date, from),
        lte(documents.date, to),
        inArray(documents.type, ["invoice", "quote"])
      )
    );

  const inv = { draft: 0, open: 0, partial: 0, overdue: 0, paid: 0, void: 0 };
  const qt = { draft: 0, open: 0, accepted: 0, declined: 0 };
  let outstandingCents = 0;
  let pastDueCents = 0;
  let paidCents = 0;

  for (const d of docs) {
    if (d.type === "invoice") {
      const isOverdue = d.status === "open" && !!d.dueDate && d.dueDate < today;
      if (isOverdue) inv.overdue++;
      else if (d.status in inv) inv[d.status as keyof typeof inv]++;
      if (["open", "partial"].includes(d.status)) {
        const bal = d.totalCents - d.paidCents;
        outstandingCents += bal;
        if (d.dueDate && d.dueDate < today) pastDueCents += bal;
      }
      paidCents += d.paidCents;
    } else {
      if (d.status in qt) qt[d.status as keyof typeof qt]++;
    }
  }
  const invTotal = Object.values(inv).reduce((a, b) => a + b, 0);
  const qtTotal = Object.values(qt).reduce((a, b) => a + b, 0);
  return { inv, invTotal, qt, qtTotal, outstandingCents, pastDueCents, paidCents };
}
