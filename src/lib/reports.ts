import { db, accounts, journalEntries, journalLines, documents, documentLines, payments, contacts, items, documentAssignments, members, contactGroupMemberships, customerGroups, itemGroups } from "@/db";
import { currentOrgId } from "@/lib/org";
import { and, eq, gte, lte, inArray, sql, exists, isNull } from "drizzle-orm";
import { acct } from "./posting";
import { SYS } from "./coa";

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
  // Inventory Adjustments gets its own bucket, split out of both COGS and
  // operating expenses: a large found-stock adjustment nets as a credit (a
  // gain) that can swing it deeply negative in a given period. Folded into
  // COGS, that inflated gross profit and made genuine product cost look
  // wrong; folded into expenses, it made a real operating expense entry look
  // like it *reduced* the expense total whenever this account's swing
  // dominated. Shown separately, both COGS and Expenses only ever move the
  // way an accountant expects when recording an ordinary transaction.
  const inventoryAdjustments = balances.filter((b) => b.type === "expense" && b.subtype === "inventory_adjustment");
  const expenses = balances.filter((b) => b.type === "expense" && b.subtype !== "cost_of_goods_sold" && b.subtype !== "inventory_adjustment");
  const totalIncome = income.reduce((s, b) => s + b.balanceCents, 0);
  const totalCogs = cogs.reduce((s, b) => s + b.balanceCents, 0);
  const totalInventoryAdjustments = inventoryAdjustments.reduce((s, b) => s + b.balanceCents, 0);
  const totalExpenses = expenses.reduce((s, b) => s + b.balanceCents, 0);
  return {
    income,
    cogs,
    inventoryAdjustments,
    expenses,
    totalIncome,
    totalCogs,
    grossProfit: totalIncome - totalCogs,
    totalInventoryAdjustments,
    totalExpenses,
    netProfit: totalIncome - totalCogs - totalInventoryAdjustments - totalExpenses,
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

const CURRENT_ASSET_SUBTYPES = ["bank", "cash", "accounts_receivable", "stock", "other_current_asset"];
const CURRENT_LIABILITY_SUBTYPES = ["accounts_payable", "current_liability"];

/**
 * Solvency/leverage ratios computed directly from the chart of accounts —
 * every figure here is a real balance-sheet total, not an approximation.
 *
 * Current assets/liabilities are split by account subtype (bank/cash/AR/stock
 * vs fixed_asset; accounts_payable/current_liability vs long_term_liability),
 * matching the same subtype scheme cashFlowStatement already uses.
 */
export async function businessRatios(asOf: string) {
  const bs = await balanceSheet(asOf);

  const currentAssetsCents = bs.assets
    .filter((a) => CURRENT_ASSET_SUBTYPES.includes(a.subtype))
    .reduce((s, a) => s + a.balanceCents, 0);
  const currentLiabilitiesCents = bs.liabilities
    .filter((l) => CURRENT_LIABILITY_SUBTYPES.includes(l.subtype))
    .reduce((s, l) => s + l.balanceCents, 0);

  const totalAssetsCents = bs.totalAssets;
  const totalLiabilitiesCents = bs.totalLiabilities;
  const totalEquityCents = bs.totalEquity;

  // Ratios are undefined (not zero) when their denominator is zero — a debt
  // ratio of "0" would misleadingly read as "no debt" when it's actually
  // "no assets recorded yet", e.g. a brand-new org with no activity.
  const safeDiv = (n: number, d: number) => (d !== 0 ? n / d : null);

  return {
    currentAssetsCents,
    currentLiabilitiesCents,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalEquityCents,
    workingCapitalCents: currentAssetsCents - currentLiabilitiesCents,
    // Working capital ratio (current ratio): current assets / current liabilities.
    workingCapitalRatio: safeDiv(currentAssetsCents, currentLiabilitiesCents),
    // Debt ratio: total liabilities / total assets — share of assets financed by debt.
    debtRatio: safeDiv(totalLiabilitiesCents, totalAssetsCents),
    // Assets-to-equity: total assets / total equity — how much of the asset base is owner-funded.
    assetsToEquityRatio: safeDiv(totalAssetsCents, totalEquityCents),
    // Debt-to-equity: total liabilities / total equity — leverage relative to owner capital.
    debtToEquityRatio: safeDiv(totalLiabilitiesCents, totalEquityCents),
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
    expensesThisMonthCents: pl.totalCogs + pl.totalInventoryAdjustments + pl.totalExpenses,
    netVatDueCents: vat.netVatDue,
  };
}

export interface WithholdingTaxRow {
  date: string;
  paymentNumber: string;
  documentNumber: string | null;
  contactName: string | null;
  kraPin: string | null;
  grossCents: number;
  whtCents: number;
  netCents: number;
  reference: string | null;
}

/**
 * Withholding tax withheld by customers when paying invoices (a prepaid tax
 * asset — KRA lets it offset corporate income tax due). Rows are derived from
 * postings to the WHT Receivable account (1310), not from payments.whtCents
 * directly: a payment row can carry a whtCents value that was never posted
 * (outgoing/vendor payments accept the same form field but postPayment()
 * currently has no ledger treatment for it — see note below), so reading the
 * ledger is what keeps this report's totals reconcilable with the books
 * rather than merely mirroring user input.
 *
 * NOTE: there is currently no symmetric "WHT payable" account for tax withheld
 * FROM vendors when we pay them — only the receivable side (customers
 * withholding from us) is wired end-to-end, so that's what this report covers.
 */
export async function withholdingTaxReport(fromDate: string, toDate: string): Promise<{
  rows: WithholdingTaxRow[];
  totalGrossCents: number;
  totalWhtCents: number;
  totalNetCents: number;
}> {
  const orgId = currentOrgId();
  const whtAccountId = await acct(SYS.WHT_RECEIVABLE);

  const lines = await db
    .select({
      date: journalEntries.date,
      sourceId: journalEntries.sourceId,
      whtDebit: journalLines.debitCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalLines.orgId, orgId),
        eq(journalLines.accountId, whtAccountId),
        eq(journalEntries.sourceType, "customer_payment"),
        gte(journalEntries.date, fromDate),
        lte(journalEntries.date, toDate)
      )
    );

  if (lines.length === 0) {
    return { rows: [], totalGrossCents: 0, totalWhtCents: 0, totalNetCents: 0 };
  }

  const paymentIds = lines.map((l) => l.sourceId).filter((id): id is number => id != null);
  const paymentRows = paymentIds.length
    ? await db
        .select({
          id: payments.id,
          number: payments.number,
          documentId: payments.documentId,
          contactId: payments.contactId,
          reference: payments.reference,
          amountCents: payments.amountCents,
        })
        .from(payments)
        .where(and(eq(payments.orgId, orgId), inArray(payments.id, paymentIds)))
    : [];
  const paymentById = new Map(paymentRows.map((p) => [p.id, p]));

  const docIds = [...new Set(paymentRows.map((p) => p.documentId).filter((id): id is number => id != null))];
  const docRows = docIds.length
    ? await db.select({ id: documents.id, number: documents.number }).from(documents).where(and(eq(documents.orgId, orgId), inArray(documents.id, docIds)))
    : [];
  const docById = new Map(docRows.map((d) => [d.id, d.number]));

  const contactIds = [...new Set(paymentRows.map((p) => p.contactId).filter((id): id is number => id != null))];
  const contactRows = contactIds.length
    ? await db.select({ id: contacts.id, name: contacts.displayName, kraPin: contacts.kraPin }).from(contacts).where(and(eq(contacts.orgId, orgId), inArray(contacts.id, contactIds)))
    : [];
  const contactById = new Map(contactRows.map((c) => [c.id, c]));

  const rows: WithholdingTaxRow[] = lines
    .filter((l) => l.sourceId != null && paymentById.has(l.sourceId))
    .map((l) => {
      const p = paymentById.get(l.sourceId!)!;
      const contact = p.contactId != null ? contactById.get(p.contactId) : undefined;
      const whtCents = Number(l.whtDebit);
      return {
        date: l.date,
        paymentNumber: p.number,
        documentNumber: p.documentId != null ? docById.get(p.documentId) ?? null : null,
        contactName: contact?.name ?? null,
        kraPin: contact?.kraPin ?? null,
        grossCents: Number(p.amountCents),
        whtCents,
        netCents: Number(p.amountCents) - whtCents,
        reference: p.reference,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    rows,
    totalGrossCents: rows.reduce((s, r) => s + r.grossCents, 0),
    totalWhtCents: rows.reduce((s, r) => s + r.whtCents, 0),
    totalNetCents: rows.reduce((s, r) => s + r.netCents, 0),
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
      subtype: accounts.subtype,
      debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(and(eq(journalLines.orgId, currentOrgId()), inArray(accounts.type, ["income", "expense"])))
    .groupBy(sql`substr(${journalEntries.date}, 1, 7)`, accounts.type, accounts.subtype);

  const now = new Date();
  const out: { month: string; label: string; incomeCents: number; expenseCents: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-KE", { month: "short" });
    const income = rows.filter((r) => r.month === key && r.type === "income")
      .reduce((s, r) => s + Number(r.credit) - Number(r.debit), 0);
    // Operating expenses only — cost_of_goods_sold and inventory_adjustment
    // are both excluded here, same split profitAndLoss() makes. Inventory
    // swings (found/damaged stock) are volatile and can net-credit that
    // subtype in a given month; folding it into this column made recording an
    // ordinary operating expense look like it *reduced* the Expense total
    // whenever a stock adjustment that month had pushed the combined figure
    // negative. Operating expense accounts alone only ever move this column
    // up when money is spent.
    const expense = rows.filter((r) => r.month === key && r.type === "expense" && r.subtype !== "cost_of_goods_sold" && r.subtype !== "inventory_adjustment")
      .reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
    out.push({ month: key, label, incomeCents: income, expenseCents: expense });
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
export async function invoicesReport(fromDate: string, toDate: string, staffName?: string) {
  const conds = [
    eq(documents.orgId, currentOrgId()),
    eq(documents.type, "invoice"),
    gte(documents.date, fromDate),
    lte(documents.date, toDate),
  ];
  if (staffName) conds.push(eq(documents.createdByName, staffName));

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
      createdByName: documents.createdByName,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(...conds))
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
    createdByName: r.createdByName,
  }));
}

export interface Vat3Row {
  kraPin: string | null;
  contactName: string | null;
  taxClass: string;
  netCents: number;
  taxCents: number;
  grossCents: number;
}

/**
 * iTax VAT3 prefill — output/input VAT broken down per counterparty PIN and
 * tax class, which is the shape KRA's return upload wants.
 *
 * Same posted-only rule as vatReturn(): a document that hasn't hit the ledger
 * (draft, pending_approval) has no VAT to declare or claim yet.
 */
export async function vat3Prefill(fromDate: string, toDate: string) {
  const POSTED = ["open", "paid", "partial"];

  const query = (types: string[]) =>
    db
      .select({
        taxClass: documentLines.taxClass,
        kraPin: contacts.kraPin,
        contactName: contacts.displayName,
        totalGross: sql<number>`sum(${documentLines.grossCents})`,
        totalTax: sql<number>`sum(${documentLines.taxCents})`,
        totalNet: sql<number>`sum(${documentLines.netCents})`,
      })
      .from(documentLines)
      .innerJoin(documents, eq(documentLines.documentId, documents.id))
      .leftJoin(contacts, eq(documents.contactId, contacts.id))
      .where(
        and(
          eq(documents.orgId, currentOrgId()),
          inArray(documents.type, types),
          inArray(documents.status, POSTED),
          gte(documents.date, fromDate),
          lte(documents.date, toDate)
        )
      )
      .groupBy(documentLines.taxClass, contacts.kraPin, contacts.displayName);

  const shape = (rows: Awaited<ReturnType<typeof query>>): Vat3Row[] =>
    rows.map((r) => ({
      kraPin: r.kraPin,
      contactName: r.contactName,
      taxClass: r.taxClass,
      netCents: Number(r.totalNet) || 0,
      taxCents: Number(r.totalTax) || 0,
      grossCents: Number(r.totalGross) || 0,
    }));

  const [output, input] = await Promise.all([query(["invoice"]), query(["bill", "expense"])]);
  return { output: shape(output), input: shape(input) };
}

/** Active staff names for report filter dropdowns. */
export async function reportStaffNames() {
  const rows = await db
    .select({ name: members.name })
    .from(members)
    .where(and(eq(members.orgId, currentOrgId()), eq(members.active, true)))
    .orderBy(members.name);
  return rows.map((r) => r.name).filter((n): n is string => !!n);
}

/**
 * Detailed Items Report (Sales)
 */
export async function itemsReport(fromDate: string, toDate: string, itemType?: string) {
  const conds = [
    eq(documents.orgId, currentOrgId()),
    eq(documents.type, "invoice"),
    inArray(documents.status, ["open", "partial", "paid"]), // excluding draft/void
    gte(documents.date, fromDate),
    lte(documents.date, toDate),
  ];
  if (itemType) {
    conds.push(eq(items.kind, itemType));
  }

  const rows = await db
    .select({
      itemId: items.id,
      itemName: items.name,
      sku: items.sku,
      kind: items.kind,
      quantitySold: sql<number>`coalesce(sum(${documentLines.qty}), 0)`,
      amountSoldCents: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .innerJoin(items, eq(documentLines.itemId, items.id))
    .where(and(...conds))
    .groupBy(items.id, items.name, items.sku, items.kind)
    .orderBy(sql`sum(${documentLines.netCents}) desc`);

  return rows.map(r => ({
    itemId: r.itemId,
    itemName: r.itemName,
    sku: r.sku,
    kind: r.kind,
    quantitySold: Number(r.quantitySold),
    amountSoldCents: Number(r.amountSoldCents)
  }));
}

export async function itemGroupsReport(fromDate: string, toDate: string) {
  const orgId = currentOrgId();
  const groups = await db.select().from(itemGroups).where(eq(itemGroups.orgId, orgId)).orderBy(itemGroups.name);
  const rows = await db
    .select({
      groupId: items.itemGroupId,
      itemCount: sql<number>`count(distinct ${items.id})`,
      quantitySold: sql<number>`coalesce(sum(${documentLines.qty}), 0)`,
      amountSoldCents: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
    })
    .from(documentLines)
    .innerJoin(documents, eq(documentLines.documentId, documents.id))
    .innerJoin(items, eq(documentLines.itemId, items.id))
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial", "paid"]),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .groupBy(items.itemGroupId);

  const byId = new Map(rows.map((r) => [r.groupId ?? 0, r]));
  const data: Array<{
    groupId: number | null;
    groupName: string;
    itemCount: number;
    quantitySold: number;
    amountSoldCents: number;
  }> = groups.map((g) => {
    const row = byId.get(g.id);
    return {
      groupId: g.id,
      groupName: g.name,
      itemCount: Number(row?.itemCount ?? 0),
      quantitySold: Number(row?.quantitySold ?? 0),
      amountSoldCents: Number(row?.amountSoldCents ?? 0),
    };
  });

  const ungrouped = byId.get(0);
  if (ungrouped) {
    data.push({
      groupId: null,
      groupName: "Ungrouped",
      itemCount: Number(ungrouped.itemCount ?? 0),
      quantitySold: Number(ungrouped.quantitySold ?? 0),
      amountSoldCents: Number(ungrouped.amountSoldCents ?? 0),
    });
  }

  return data.sort((a, b) => b.amountSoldCents - a.amountSoldCents);
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
export async function customersReport(fromDate: string, toDate: string, groupId?: number | null) {
  const orgId = currentOrgId();
  const conds = [
    eq(documents.orgId, orgId),
    eq(documents.type, "invoice"),
    inArray(documents.status, ["open", "partial", "paid"]),
    gte(documents.date, fromDate),
    lte(documents.date, toDate),
  ];
  if (groupId) {
    const members = await db
      .select({ id: contactGroupMemberships.contactId })
      .from(contactGroupMemberships)
      .where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.groupId, groupId)));
    const ids = members.map((m) => m.id);
    if (ids.length === 0) return [];
    conds.push(inArray(documents.contactId, ids));
  }

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
    .where(and(...conds))
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

export async function customerGroupsReport(fromDate: string, toDate: string) {
  const orgId = currentOrgId();
  const groups = await db.select().from(customerGroups).where(eq(customerGroups.orgId, orgId)).orderBy(customerGroups.name);
  const rows = await db
    .select({
      groupId: contactGroupMemberships.groupId,
      customerCount: sql<number>`count(distinct ${contactGroupMemberships.contactId})`,
      totalSalesCents: sql<number>`coalesce(sum(${documents.totalCents}), 0)`,
      paidCents: sql<number>`coalesce(sum(${documents.paidCents}), 0)`,
      creditedCents: sql<number>`coalesce(sum(${documents.creditedCents}), 0)`,
      invoiceCount: sql<number>`count(distinct ${documents.id})`,
    })
    .from(contactGroupMemberships)
    .leftJoin(
      documents,
      and(
        eq(documents.contactId, contactGroupMemberships.contactId),
        eq(documents.orgId, orgId),
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial", "paid"]),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    )
    .where(eq(contactGroupMemberships.orgId, orgId))
    .groupBy(contactGroupMemberships.groupId);

  const byId = new Map(rows.map((r) => [r.groupId, r]));
  return groups
    .map((g) => {
      const row = byId.get(g.id);
      const totalSalesCents = Number(row?.totalSalesCents ?? 0);
      const paidCents = Number(row?.paidCents ?? 0);
      const creditedCents = Number(row?.creditedCents ?? 0);
      return {
        groupId: g.id,
        groupName: g.name,
        customerCount: Number(row?.customerCount ?? 0),
        invoiceCount: Number(row?.invoiceCount ?? 0),
        totalSalesCents,
        paidCents,
        balanceCents: totalSalesCents - paidCents - creditedCents,
      };
    })
    .sort((a, b) => b.totalSalesCents - a.totalSalesCents);
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

export interface CustomerProfitability {
  invoicedCents: number;
  creditedCents: number;
  netRevenueCents: number;
  taggedCostCents: number;
  grossMarginCents: number;
  marginPct: number | null;
  /** Costs tagged to this customer but not linked to any invoice. */
  unlinkedCostCents: number;
  /** Org-wide costs with no customer tag at all in this period — the blind spot. */
  untaggedCostCents: number;
  avgDaysToPay: number | null;
  onTimeRate: number | null;
  perInvoice: {
    id: number;
    number: string;
    date: string;
    status: string;
    revenueCents: number;
    costCents: number;
    marginCents: number;
  }[];
}

/**
 * Profit on one customer: revenue actually billed, less the costs tagged to
 * them via documents.customerContactId.
 *
 * Margin is only ever as honest as the tagging, so untaggedCostCents reports
 * what the number can't see — a customer with no tagged costs looks perfectly
 * profitable otherwise.
 */
export async function customerProfitability(
  contactId: number,
  fromDate: string,
  toDate: string
): Promise<CustomerProfitability> {
  const orgId = currentOrgId();
  const POSTED = ["open", "paid", "partial", "closed"];

  const sales = await db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      date: documents.date,
      status: documents.status,
      totalCents: documents.totalCents,
      paidCents: documents.paidCents,
      dueDate: documents.dueDate,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.contactId, contactId),
        inArray(documents.type, ["invoice", "credit_note"]),
        eq(documents.isTemplate, false),
        inArray(documents.status, POSTED),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    );

  const invoices = sales.filter((d) => d.type === "invoice");
  const invoicedCents = invoices.reduce((s, d) => s + Number(d.totalCents), 0);
  const creditedCents = sales
    .filter((d) => d.type === "credit_note")
    .reduce((s, d) => s + Number(d.totalCents), 0);

  // Costs tagged to this customer, whether or not they name an invoice.
  const costs = await db
    .select({
      id: documents.id,
      totalCents: documents.totalCents,
      relatedInvoiceId: documents.relatedInvoiceId,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.customerContactId, contactId),
        inArray(documents.type, ["bill", "expense"]),
        inArray(documents.status, POSTED),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    );

  const taggedCostCents = costs.reduce((s, d) => s + Number(d.totalCents), 0);
  const unlinkedCostCents = costs
    .filter((d) => !d.relatedInvoiceId)
    .reduce((s, d) => s + Number(d.totalCents), 0);

  const [untagged] = await db
    .select({ total: sql<number>`coalesce(sum(${documents.totalCents}), 0)` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        isNull(documents.customerContactId),
        inArray(documents.type, ["bill", "expense"]),
        inArray(documents.status, POSTED),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    );

  const netRevenueCents = invoicedCents - creditedCents;
  const grossMarginCents = netRevenueCents - taggedCostCents;

  // Payment behaviour, from the settling payment on each fully-paid invoice.
  const paidInvoices = invoices.filter((d) => d.status === "paid");
  let avgDaysToPay: number | null = null;
  let onTimeRate: number | null = null;
  if (paidInvoices.length > 0) {
    const rows = await db
      .select({ documentId: payments.documentId, date: payments.date })
      .from(payments)
      .where(
        and(
          eq(payments.orgId, orgId),
          inArray(payments.documentId, paidInvoices.map((d) => d.id))
        )
      );
    const settledOn = new Map<number, string>();
    for (const p of rows) {
      const cur = settledOn.get(p.documentId!);
      if (!cur || p.date > cur) settledOn.set(p.documentId!, p.date); // last payment settles it
    }
    const days: number[] = [];
    let onTime = 0;
    let dueCount = 0;
    for (const inv of paidInvoices) {
      const settled = settledOn.get(inv.id);
      if (!settled) continue;
      const d = Math.round((Date.parse(settled) - Date.parse(inv.date)) / 86400000);
      days.push(Math.max(0, d)); // a payment dated before issue is data entry, not a negative wait
      if (inv.dueDate) {
        dueCount++;
        if (settled <= inv.dueDate) onTime++;
      }
    }
    if (days.length) avgDaysToPay = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
    if (dueCount) onTimeRate = onTime / dueCount;
  }

  const costByInvoice = new Map<number, number>();
  for (const c of costs) {
    if (!c.relatedInvoiceId) continue;
    costByInvoice.set(c.relatedInvoiceId, (costByInvoice.get(c.relatedInvoiceId) ?? 0) + Number(c.totalCents));
  }

  const perInvoice = invoices
    .map((inv) => {
      const costCents = costByInvoice.get(inv.id) ?? 0;
      return {
        id: inv.id,
        number: inv.number,
        date: inv.date,
        status: inv.status,
        revenueCents: Number(inv.totalCents),
        costCents,
        marginCents: Number(inv.totalCents) - costCents,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    invoicedCents,
    creditedCents,
    netRevenueCents,
    taggedCostCents,
    grossMarginCents,
    marginPct: netRevenueCents > 0 ? grossMarginCents / netRevenueCents : null,
    unlinkedCostCents,
    untaggedCostCents: Number(untagged?.total ?? 0),
    avgDaysToPay,
    onTimeRate,
    perInvoice,
  };
}

export interface VendorSpend {
  totalSpendCents: number;
  billCount: number;
  expenseCount: number;
  outstandingCents: number;
  /** This vendor's share of all vendor spend in the period. */
  sharePct: number | null;
  avgDaysToPay: number | null;
  byAccount: { accountId: number | null; name: string; amountCents: number }[];
  byMonth: { month: string; amountCents: number }[];
  recent: {
    id: number;
    type: string;
    number: string;
    date: string;
    status: string;
    totalCents: number;
    balanceCents: number;
  }[];
}

/** What one vendor costs: spend over time, by expense account, and how fast they get paid. */
export async function vendorSpend(
  contactId: number,
  fromDate: string,
  toDate: string
): Promise<VendorSpend> {
  const orgId = currentOrgId();
  const POSTED = ["open", "paid", "partial", "closed"];

  const docs = await db
    .select({
      id: documents.id,
      type: documents.type,
      number: documents.number,
      date: documents.date,
      status: documents.status,
      totalCents: documents.totalCents,
      paidCents: documents.paidCents,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.contactId, contactId),
        inArray(documents.type, ["bill", "expense"]),
        eq(documents.isTemplate, false),
        inArray(documents.status, POSTED),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    );

  const totalSpendCents = docs.reduce((s, d) => s + Number(d.totalCents), 0);
  const outstandingCents = docs.reduce(
    (s, d) => s + Math.max(0, Number(d.totalCents) - Number(d.paidCents)),
    0
  );

  const [allVendors] = await db
    .select({ total: sql<number>`coalesce(sum(${documents.totalCents}), 0)` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        inArray(documents.type, ["bill", "expense"]),
        eq(documents.isTemplate, false),
        inArray(documents.status, POSTED),
        gte(documents.date, fromDate),
        lte(documents.date, toDate)
      )
    );
  const allSpend = Number(allVendors?.total ?? 0);

  // Spend split by the expense account each line was categorised to.
  const accountRows = docs.length
    ? await db
        .select({
          accountId: documentLines.accountId,
          name: accounts.name,
          amount: sql<number>`coalesce(sum(${documentLines.netCents}), 0)`,
        })
        .from(documentLines)
        .leftJoin(accounts, eq(documentLines.accountId, accounts.id))
        .where(
          and(
            eq(documentLines.orgId, orgId),
            inArray(documentLines.documentId, docs.map((d) => d.id))
          )
        )
        .groupBy(documentLines.accountId, accounts.name)
    : [];

  const byAccount = accountRows
    .map((r) => ({
      accountId: r.accountId,
      name: r.name ?? "Uncategorised",
      amountCents: Number(r.amount),
    }))
    .sort((a, b) => b.amountCents - a.amountCents);

  const monthMap = new Map<string, number>();
  for (const d of docs) {
    const m = d.date.slice(0, 7);
    monthMap.set(m, (monthMap.get(m) ?? 0) + Number(d.totalCents));
  }
  const byMonth = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, amountCents]) => ({ month, amountCents }));

  // How long we take to settle this vendor, from the final payment on paid docs.
  const paid = docs.filter((d) => d.status === "paid");
  let avgDaysToPay: number | null = null;
  if (paid.length) {
    const rows = await db
      .select({ documentId: payments.documentId, date: payments.date })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), inArray(payments.documentId, paid.map((d) => d.id))));
    const settledOn = new Map<number, string>();
    for (const p of rows) {
      const cur = settledOn.get(p.documentId!);
      if (!cur || p.date > cur) settledOn.set(p.documentId!, p.date);
    }
    const days: number[] = [];
    for (const d of paid) {
      const settled = settledOn.get(d.id);
      if (!settled) continue;
      days.push(Math.max(0, Math.round((Date.parse(settled) - Date.parse(d.date)) / 86400000)));
    }
    if (days.length) avgDaysToPay = Math.round(days.reduce((a, b) => a + b, 0) / days.length);
  }

  return {
    totalSpendCents,
    billCount: docs.filter((d) => d.type === "bill").length,
    expenseCount: docs.filter((d) => d.type === "expense").length,
    outstandingCents,
    sharePct: allSpend > 0 ? totalSpendCents / allSpend : null,
    avgDaysToPay,
    byAccount,
    byMonth,
    recent: docs
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map((d) => ({
        id: d.id,
        type: d.type,
        number: d.number,
        date: d.date,
        status: d.status,
        totalCents: Number(d.totalCents),
        balanceCents: Math.max(0, Number(d.totalCents) - Number(d.paidCents)),
      })),
  };
}

export interface CustomerMarginRow {
  contactId: number;
  customerName: string;
  netRevenueCents: number;
  taggedCostCents: number;
  grossMarginCents: number;
  marginPct: number | null;
}

/**
 * Every customer ranked by margin, for "which clients are actually worth it".
 *
 * Aggregated in two grouped queries rather than calling customerProfitability
 * per contact, which would be an N+1 across the whole contact book.
 */
export async function customerMarginRanking(fromDate: string, toDate: string, groupId?: number | null) {
  const orgId = currentOrgId();
  const POSTED = ["open", "paid", "partial", "closed"];

  // When a group is filtered, restrict to the customers in it — used to scope
  // both revenue and the cost attribution, so the two sides stay consistent.
  let groupMemberIds: number[] | null = null;
  if (groupId) {
    const members = await db
      .select({ id: contactGroupMemberships.contactId })
      .from(contactGroupMemberships)
      .where(and(eq(contactGroupMemberships.orgId, orgId), eq(contactGroupMemberships.groupId, groupId)));
    groupMemberIds = members.map((m) => m.id);
    if (groupMemberIds.length === 0) {
      return { rows: [], untaggedCostCents: 0, totalRevenueCents: 0, totalCostCents: 0, totalMarginCents: 0 };
    }
  }

  // Credit notes subtract, so sign the sum by type in SQL.
  const revConds = [
    eq(documents.orgId, orgId),
    inArray(documents.type, ["invoice", "credit_note"]),
    eq(documents.isTemplate, false),
    inArray(documents.status, POSTED),
    gte(documents.date, fromDate),
    lte(documents.date, toDate),
  ];
  if (groupMemberIds) revConds.push(inArray(documents.contactId, groupMemberIds));

  const revenueRows = await db
    .select({
      contactId: documents.contactId,
      customerName: contacts.displayName,
      net: sql<number>`coalesce(sum(case when ${documents.type} = 'credit_note' then -${documents.totalCents} else ${documents.totalCents} end), 0)`,
    })
    .from(documents)
    .innerJoin(contacts, eq(documents.contactId, contacts.id))
    .where(and(...revConds))
    .groupBy(documents.contactId, contacts.displayName);

  const costConds = [
    eq(documents.orgId, orgId),
    inArray(documents.type, ["bill", "expense"]),
    inArray(documents.status, POSTED),
    gte(documents.date, fromDate),
    lte(documents.date, toDate),
  ];
  // A group filter scopes costs to that group's customers, and untagged costs
  // (no customer) fall outside any group, so they're excluded from a group view.
  if (groupMemberIds) costConds.push(inArray(documents.customerContactId, groupMemberIds));

  const costRows = await db
    .select({
      contactId: documents.customerContactId,
      cost: sql<number>`coalesce(sum(${documents.totalCents}), 0)`,
    })
    .from(documents)
    .where(and(...costConds))
    .groupBy(documents.customerContactId);

  const costByCustomer = new Map<number, number>();
  let untaggedCostCents = 0;
  for (const r of costRows) {
    if (r.contactId == null) untaggedCostCents += Number(r.cost);
    else costByCustomer.set(r.contactId, Number(r.cost));
  }

  const rows: CustomerMarginRow[] = revenueRows.map((r) => {
    const netRevenueCents = Number(r.net);
    const taggedCostCents = costByCustomer.get(r.contactId!) ?? 0;
    const grossMarginCents = netRevenueCents - taggedCostCents;
    return {
      contactId: r.contactId!,
      customerName: r.customerName,
      netRevenueCents,
      taggedCostCents,
      grossMarginCents,
      marginPct: netRevenueCents > 0 ? grossMarginCents / netRevenueCents : null,
    };
  });

  // A customer can carry tagged costs in a period with no revenue — a loss that
  // would otherwise vanish from the ranking entirely.
  for (const [contactId, cost] of costByCustomer) {
    if (rows.some((r) => r.contactId === contactId)) continue;
    const [c] = await db
      .select({ name: contacts.displayName })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId)))
      .limit(1);
    rows.push({
      contactId,
      customerName: c?.name ?? "Unknown",
      netRevenueCents: 0,
      taggedCostCents: cost,
      grossMarginCents: -cost,
      marginPct: null,
    });
  }

  rows.sort((a, b) => b.grossMarginCents - a.grossMarginCents);

  return {
    rows,
    untaggedCostCents,
    totalRevenueCents: rows.reduce((s, r) => s + r.netRevenueCents, 0),
    totalCostCents: rows.reduce((s, r) => s + r.taggedCostCents, 0),
    totalMarginCents: rows.reduce((s, r) => s + r.grossMarginCents, 0),
  };
}
