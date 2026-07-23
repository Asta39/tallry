import { db, accounts, journalEntries, journalLines, documents, documentLines, payments, contacts, items, documentAssignments } from "@/db";
import { currentOrgId } from "@/lib/org";
import { and, eq, gte, lte, inArray, sql, exists } from "drizzle-orm";

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

/**
 * Cash flow for a period. "Net Change in Cash (actual)" is derived directly from
 * bank/cash-account ledger movement — the ground truth, since it's just the sum of
 * debits/credits posted to those accounts. The Operating/Investing/Financing split is
 * a categorized approximation (no AR/AP/inventory working-capital adjustments), so it
 * is cross-checked against the actual figure rather than assumed correct.
 */
export async function cashFlowStatement(from: string, to: string) {
  const period = await accountBalances({ from, to });
  const pl = await profitAndLoss(from, to);
  const netOp = pl.netProfit;

  const investing = period.filter((b) => b.type === "asset" && b.subtype === "fixed_asset");
  const netInv = -investing.reduce((s, b) => s + b.balanceCents, 0);

  const financing = period.filter((b) => b.type === "equity" || (b.type === "liability" && b.subtype === "long_term_liability"));
  const netFin = financing.reduce((s, b) => s + b.balanceCents, 0);

  const netChangeComputed = netOp + netInv + netFin;

  const cashAccounts = period.filter((b) => b.subtype === "bank" || b.subtype === "cash");
  const netChangeActual = cashAccounts.reduce((s, b) => s + b.balanceCents, 0);

  return { netOp, netInv, netFin, netChangeComputed, netChangeActual };
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
        // Only documents actually posted to the ledger count as VAT — a bill sitting in
        // "pending_approval" (or any other non-posted status) has no journal entry yet
        // and must not be claimed as input VAT until it's approved and posted.
        inArray(documents.status, ["open", "paid", "partial"]),
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
    const balance = d.totalCents - d.paidCents - d.creditedCents;
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

/** Signed balance of an account for all activity strictly before `from` — the GL's opening-balance line. */
export async function accountOpeningBalance(accountId: number, from: string): Promise<{ balanceCents: number; debitNature: boolean }> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const debitNature = account?.type === "asset" || account?.type === "expense";
  const [row] = await db
    .select({
      debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(and(
      eq(journalLines.orgId, currentOrgId()),
      eq(journalLines.accountId, accountId),
      sql`${journalEntries.date} < ${from}`,
    ));
  const debit = Number(row?.debit || 0);
  const credit = Number(row?.credit || 0);
  return { balanceCents: debitNature ? debit - credit : credit - debit, debitNature };
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
export async function docStatusOverview(year: string, memberId?: number) {
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
      creditedCents: documents.creditedCents,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        gte(documents.date, from),
        lte(documents.date, to),
        inArray(documents.type, ["invoice", "quote"]),
        // Scoped view: only documents assigned to this staff member
        memberId
          ? exists(
              db.select().from(documentAssignments).where(and(
                eq(documentAssignments.documentId, documents.id),
                eq(documentAssignments.memberId, memberId),
              ))
            )
          : undefined
      )
    );

  const inv = { draft: 0, open: 0, partial: 0, overdue: 0, paid: 0, void: 0 };
  const qt = { draft: 0, open: 0, accepted: 0, declined: 0 };
  let outstandingCents = 0;
  let pastDueCents = 0;
  let paidCents = 0;

  for (const d of docs) {
    if (d.type === "invoice") {
      const isOverdue = (d.status === "open" || d.status === "partial") && !!d.dueDate && d.dueDate < today;
      if (isOverdue) inv.overdue++;
      else if (d.status in inv) inv[d.status as keyof typeof inv]++;
      if (["open", "partial"].includes(d.status)) {
        const bal = d.totalCents - d.paidCents - d.creditedCents;
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

/**
 * Dashboard cards for a staff member scoped to their own (assigned) documents.
 * Ledger-wide figures (cash, VAT) intentionally excluded — those are company data.
 */
export async function memberDashboardStats(memberId: number, today: string) {
  const yearStart = today.slice(0, 4) + "-01-01";
  const docs = await db
    .select({
      type: documents.type,
      status: documents.status,
      date: documents.date,
      dueDate: documents.dueDate,
      totalCents: documents.totalCents,
      paidCents: documents.paidCents,
      creditedCents: documents.creditedCents,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        inArray(documents.type, ["invoice", "bill", "expense"]),
        exists(
          db.select().from(documentAssignments).where(and(
            eq(documentAssignments.documentId, documents.id),
            eq(documentAssignments.memberId, memberId),
          ))
        )
      )
    );

  let receivablesCents = 0;
  let overdueReceivablesCents = 0;
  let payablesCents = 0;
  let collectedThisYearCents = 0;

  for (const d of docs) {
    const bal = d.totalCents - d.paidCents - d.creditedCents;
    const open = ["open", "partial", "overdue"].includes(d.status);
    if (d.type === "invoice") {
      if (open) {
        receivablesCents += bal;
        if (d.dueDate && d.dueDate < today) overdueReceivablesCents += bal;
      }
      if (d.date >= yearStart) collectedThisYearCents += d.paidCents;
    } else if (open) {
      payablesCents += bal;
    }
  }

  return { receivablesCents, overdueReceivablesCents, payablesCents, collectedThisYearCents };
}

/**
 * Additional logic for the Sales Dashboard
 */
export async function salesDashboardStats(today: string, period: "this_month" | "this_year" | "last_6_months" = "last_6_months") {
  // 1. Total Income Trend (Last 6 Months)
  // We can just use the existing monthlyIncomeExpense
  const incomeTrend = await monthlyIncomeExpense(6);

  // Determine date ranges
  const currentYear = today.slice(0, 4);
  const currentMonth = today.slice(0, 7);
  let fromDate = `${currentYear}-01-01`; // Default this year
  let toDate = today;

  if (period === "this_month") {
    fromDate = `${currentMonth}-01`;
  }

  // 2. Payment Modes
  const paymentRows = await db
    .select({
      mode: payments.method,
      amount: sql<number>`coalesce(sum(${payments.amountCents}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.orgId, currentOrgId()),
        gte(payments.date, fromDate),
        lte(payments.date, toDate)
      )
    )
    .groupBy(payments.method);

  const paymentModes = paymentRows.map(r => ({
    mode: r.mode || "Unknown",
    amountCents: Number(r.amount)
  })).sort((a, b) => b.amountCents - a.amountCents);

  // 3. Top Customers
  const customerRows = await db
    .select({
      contactId: documents.contactId,
      name: contacts.displayName,
      totalSales: sql<number>`coalesce(sum(${documents.totalCents}), 0)`,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial", "paid"]), // exclude draft/void
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .groupBy(documents.contactId, contacts.displayName)
    .orderBy(sql`sum(${documents.totalCents}) desc`)
    .limit(5);

  const topCustomers = customerRows.map(r => ({
    id: r.contactId,
    name: r.name,
    amountCents: Number(r.totalSales)
  }));

  return {
    incomeTrend,
    paymentModes,
    topCustomers
  };
}

/**
 * Detailed Invoices Report
 */
export async function invoicesReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      id: documents.id,
      date: documents.date,
      number: documents.number,
      status: documents.status,
      totalCents: documents.totalCents,
      paidCents: documents.paidCents,
      creditedCents: documents.creditedCents,
      contactId: documents.contactId,
      customerName: contacts.displayName,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "invoice"),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .orderBy(sql`${documents.date} desc`, sql`${documents.number} desc`);

  return rows.map(r => ({
    id: r.id,
    date: r.date,
    number: r.number,
    status: r.status,
    totalCents: Number(r.totalCents),
    paidCents: Number(r.paidCents),
    balanceCents: Number(r.totalCents) - Number(r.paidCents) - Number(r.creditedCents),
    customerName: r.customerName,
  }));
}

/**
 * Detailed Items Report (Sales)
 */
export async function itemsReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      itemId: items.id,
      itemName: items.name,
      sku: items.sku,
      quantitySold: sql<number>`coalesce(sum(${documentLines.qty}), 0)`,
      amountSoldCents: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .innerJoin(items, eq(documentLines.itemId, items.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial", "paid"]), // excluding draft/void
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .groupBy(items.id, items.name, items.sku)
    .orderBy(sql`sum(${documentLines.netCents}) desc`);

  return rows.map(r => ({
    itemId: r.itemId,
    itemName: r.itemName,
    sku: r.sku,
    quantitySold: Number(r.quantitySold),
    amountSoldCents: Number(r.amountSoldCents)
  }));
}

/**
 * Payments Received Report
 */
export async function paymentsReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      id: payments.id,
      date: payments.date,
      number: payments.number,
      method: payments.method,
      amountCents: payments.amountCents,
      invoiceNumber: documents.number,
      customerName: contacts.displayName,
    })
    .from(payments)
    .leftJoin(documents, eq(payments.documentId, documents.id))
    .leftJoin(contacts, eq(payments.contactId, contacts.id))
    .where(
      and(
        eq(payments.orgId, currentOrgId()),
        eq(payments.direction, "in"),
        gte(payments.date, fromDate),
        lte(payments.date, toDate)
      )
    )
    .orderBy(sql`${payments.date} desc`, sql`${payments.number} desc`);

  return rows.map(r => ({
    id: r.id,
    date: r.date,
    number: r.number,
    method: r.method,
    amountCents: Number(r.amountCents),
    invoiceNumber: r.invoiceNumber,
    customerName: r.customerName,
  }));
}

/**
 * Credit Notes Report
 */
export async function creditNotesReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      id: documents.id,
      date: documents.date,
      number: documents.number,
      status: documents.status,
      totalCents: documents.totalCents,
      customerName: contacts.displayName,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "credit_note"),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .orderBy(sql`${documents.date} desc`, sql`${documents.number} desc`);

  return rows.map(r => ({
    id: r.id,
    date: r.date,
    number: r.number,
    status: r.status,
    totalCents: Number(r.totalCents),
    customerName: r.customerName,
  }));
}

/**
 * Estimates Report
 */
export async function estimatesReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      id: documents.id,
      date: documents.date,
      number: documents.number,
      status: documents.status,
      totalCents: documents.totalCents,
      customerName: contacts.displayName,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "quote"), // quotes are used as estimates
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .orderBy(sql`${documents.date} desc`, sql`${documents.number} desc`);

  return rows.map(r => ({
    id: r.id,
    date: r.date,
    number: r.number,
    status: r.status,
    totalCents: Number(r.totalCents),
    customerName: r.customerName,
  }));
}

/**
 * Customers Sales Report
 */
export async function customersReport(fromDate: string, toDate: string) {
  const rows = await db
    .select({
      contactId: documents.contactId,
      customerName: contacts.displayName,
      totalSalesCents: sql<number>`coalesce(sum(${documents.totalCents}), 0)`,
      paidCents: sql<number>`coalesce(sum(${documents.paidCents}), 0)`,
      creditedCents: sql<number>`coalesce(sum(${documents.creditedCents}), 0)`,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(
      and(
        eq(documents.orgId, currentOrgId()),
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial", "paid"]),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .groupBy(documents.contactId, contacts.displayName)
    .orderBy(sql`sum(${documents.totalCents}) desc`);

  return rows.map(r => ({
    contactId: r.contactId,
    customerName: r.customerName,
    totalSalesCents: Number(r.totalSalesCents),
    paidCents: Number(r.paidCents),
    balanceCents: Number(r.totalSalesCents) - Number(r.paidCents) - Number(r.creditedCents),
  }));
}


/**
 * Parses a period string (e.g., 'this_month', 'last_month', 'this_quarter', 'this_year', 'all_time')
 * and returns { fromDate, toDate } in YYYY-MM-DD format.
 */
export function parsePeriod(period: string, defaultPeriod: string = "this_month"): { fromDate: string; toDate: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const d = today.getDate();

  const toISO = (date: Date) => date.toISOString().slice(0, 10);

  const p = period || defaultPeriod;
  let fromDate = "";
  let toDate = toISO(today);

  switch (p) {
    case "this_month":
      fromDate = toISO(new Date(y, m, 1));
      break;
    case "last_month":
      fromDate = toISO(new Date(y, m - 1, 1));
      toDate = toISO(new Date(y, m, 0));
      break;
    case "this_quarter":
      const qStartMonth = Math.floor(m / 3) * 3;
      fromDate = toISO(new Date(y, qStartMonth, 1));
      break;
    case "this_year":
      fromDate = toISO(new Date(y, 0, 1));
      break;
    case "all_time":
      fromDate = "1970-01-01";
      break;
    default:
      fromDate = toISO(new Date(y, m, 1)); // default this month
  }
  return { fromDate, toDate };
}

/** P&L subtotals per cost center (dimension) for a period — untagged lines roll into "Unassigned". */
export async function costCenterPnL(from: string, to: string) {
  const { costCenters } = await import("@/db");
  const rows = await db
    .select({
      costCenterId: journalLines.costCenterId,
      accountType: accounts.type,
      debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(
      eq(journalLines.orgId, currentOrgId()),
      gte(journalEntries.date, from),
      lte(journalEntries.date, to),
      inArray(accounts.type, ["income", "expense"]),
    ))
    .groupBy(journalLines.costCenterId, accounts.type);

  const allCostCenters = await db.select().from(costCenters).where(eq(costCenters.orgId, currentOrgId()));
  const nameById = new Map(allCostCenters.map((c) => [c.id, c.name]));

  const byCostCenter = new Map<number | null, { income: number; expense: number }>();
  for (const r of rows) {
    const key = r.costCenterId;
    const agg = byCostCenter.get(key) || { income: 0, expense: 0 };
    if (r.accountType === "income") agg.income += Number(r.credit) - Number(r.debit);
    else agg.expense += Number(r.debit) - Number(r.credit);
    byCostCenter.set(key, agg);
  }

  return Array.from(byCostCenter.entries())
    .map(([id, agg]) => ({
      costCenterId: id,
      name: id === null ? "Unassigned" : nameById.get(id) || `Cost center #${id}`,
      incomeCents: agg.income,
      expenseCents: agg.expense,
      netCents: agg.income - agg.expense,
    }))
    .sort((a, b) => b.netCents - a.netCents);
}
