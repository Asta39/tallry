import { NextRequest, NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import React from "react";
import { ReportPdf } from "@/lib/pdf/ReportPdf";
import { getOrg, withOrg } from "@/lib/org";
import { fmtKES, todayISO } from "@/lib/money";
import {
  accountBalances,
  profitAndLoss,
  balanceSheet,
  aging,
  vatReturn,
  monthlyIncomeExpense,
  generalLedger
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  return withOrg(async () => {
    try {
      const org = await getOrg();
      const { type } = await params;
      const { searchParams } = new URL(request.url);
      const download = searchParams.get("download") === "1";
      
      // Default params
      const asOf = searchParams.get("asOf") || todayISO();
      const from = searchParams.get("from") || `${new Date().getFullYear()}-01-01`;
      const to = searchParams.get("to") || todayISO();
      const accountId = searchParams.get("accountId");

      let title = "Report";
      let subtitle = "";
      let columns: { header: string; align: "left" | "right" | "center"; widthPct?: number }[] = [];
      let rows: { id: string; cells: string[]; isHeader?: boolean; isBold?: boolean; isIndent?: boolean }[] = [];

      if (type === "trial-balance") {
        title = "Trial Balance";
        subtitle = `As of ${asOf}`;
        columns = [
          { header: "Account", align: "left", widthPct: 50 },
          { header: "Debit", align: "right", widthPct: 25 },
          { header: "Credit", align: "right", widthPct: 25 },
        ];
        const bals = await accountBalances({ to: asOf });
        let totDeb = 0;
        let totCred = 0;
        bals.forEach((b) => {
          if (b.debitCents > 0 || b.creditCents > 0) {
            rows.push({
              id: b.accountId.toString(),
              cells: [`${b.code} - ${b.name}`, fmtKES(b.debitCents), fmtKES(b.creditCents)],
            });
            totDeb += b.debitCents;
            totCred += b.creditCents;
          }
        });
        rows.push({
          id: "total",
          isBold: true,
          isHeader: true,
          cells: ["Total", fmtKES(totDeb), fmtKES(totCred)],
        });
      } else if (type === "pnl") {
        title = "Profit & Loss";
        subtitle = `From ${from} to ${to}`;
        columns = [
          { header: "Account", align: "left", widthPct: 70 },
          { header: "Total", align: "right", widthPct: 30 },
        ];
        const pl = await profitAndLoss(from, to);
        
        rows.push({ id: "inc-h", cells: ["Income"], isHeader: true });
        pl.income.forEach((b) => rows.push({ id: `inc-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "inc-t", cells: ["Total Income", fmtKES(pl.totalIncome)], isBold: true });

        rows.push({ id: "cogs-h", cells: ["Cost of Goods Sold"], isHeader: true });
        pl.cogs.forEach((b) => rows.push({ id: `cogs-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "cogs-t", cells: ["Total COGS", fmtKES(pl.totalCogs)], isBold: true });
        
        rows.push({ id: "gp-t", cells: ["Gross Profit", fmtKES(pl.grossProfit)], isBold: true, isHeader: true });

        rows.push({ id: "exp-h", cells: ["Operating Expenses"], isHeader: true });
        pl.expenses.forEach((b) => rows.push({ id: `exp-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "exp-t", cells: ["Total Expenses", fmtKES(pl.totalExpenses)], isBold: true });

        rows.push({ id: "np-t", cells: ["Net Profit", fmtKES(pl.netProfit)], isBold: true, isHeader: true });

      } else if (type === "balance-sheet") {
        title = "Balance Sheet";
        subtitle = `As of ${asOf}`;
        columns = [
          { header: "Account", align: "left", widthPct: 70 },
          { header: "Balance", align: "right", widthPct: 30 },
        ];
        const bs = await balanceSheet(asOf);

        rows.push({ id: "ass-h", cells: ["Assets"], isHeader: true });
        bs.assets.forEach((b) => rows.push({ id: `a-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "ass-t", cells: ["Total Assets", fmtKES(bs.totalAssets)], isBold: true });

        rows.push({ id: "lia-h", cells: ["Liabilities"], isHeader: true });
        bs.liabilities.forEach((b) => rows.push({ id: `l-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "lia-t", cells: ["Total Liabilities", fmtKES(bs.totalLiabilities)], isBold: true });

        rows.push({ id: "eq-h", cells: ["Equity"], isHeader: true });
        bs.equity.forEach((b) => rows.push({ id: `e-${b.accountId}`, cells: [b.name, fmtKES(b.balanceCents)] }));
        rows.push({ id: "eq-ear", cells: ["Current Year Earnings", fmtKES(bs.currentEarningsCents)] });
        rows.push({ id: "eq-t", cells: ["Total Equity", fmtKES(bs.totalEquity)], isBold: true });

      } else if (type === "aging") {
        title = "Aged Receivables";
        subtitle = `As of ${asOf}`;
        columns = [
          { header: "Customer / Doc", align: "left", widthPct: 40 },
          { header: "Total", align: "right", widthPct: 15 },
          { header: "1-30", align: "right", widthPct: 15 },
          { header: "31-60", align: "right", widthPct: 15 },
          { header: "60+", align: "right", widthPct: 15 },
        ];
        const ag = await aging("invoice", asOf);
        ag.rows.forEach(r => {
          rows.push({
            id: r.id.toString(),
            cells: [
              r.number,
              fmtKES(r.balanceCents),
              r.bucket === "d1_30" ? fmtKES(r.balanceCents) : "-",
              r.bucket === "d31_60" ? fmtKES(r.balanceCents) : "-",
              ["d61_90", "d90plus"].includes(r.bucket) ? fmtKES(r.balanceCents) : "-",
            ]
          });
        });
        rows.push({
          id: "total",
          isHeader: true,
          isBold: true,
          cells: [
            "Total",
            fmtKES(ag.total),
            fmtKES(ag.buckets.d1_30),
            fmtKES(ag.buckets.d31_60),
            fmtKES(ag.buckets.d61_90 + ag.buckets.d90plus),
          ]
        });

      } else if (type === "vat") {
        title = "VAT Return";
        subtitle = `From ${from} to ${to}`;
        columns = [
          { header: "Category", align: "left", widthPct: 60 },
          { header: "Net", align: "right", widthPct: 20 },
          { header: "VAT", align: "right", widthPct: 20 },
        ];
        const v = await vatReturn(from, to);
        rows.push({ id: "s-h", cells: ["Sales (Output VAT)"], isHeader: true });
        rows.push({ id: "s-b16", cells: ["B16 - 16% General Rate", fmtKES(v.sales.B16.net), fmtKES(v.sales.B16.tax)] });
        rows.push({ id: "s-c0", cells: ["C0 - 0% Zero Rated", fmtKES(v.sales.C0.net), fmtKES(v.sales.C0.tax)] });
        rows.push({ id: "s-ex", cells: ["Exempt", fmtKES(v.sales.A_EXEMPT.net), fmtKES(v.sales.A_EXEMPT.tax)] });
        
        rows.push({ id: "p-h", cells: ["Purchases (Input VAT)"], isHeader: true });
        rows.push({ id: "p-b16", cells: ["B16 - 16% General Rate", fmtKES(v.purchases.B16.net), fmtKES(v.purchases.B16.tax)] });
        rows.push({ id: "p-c0", cells: ["C0 - 0% Zero Rated", fmtKES(v.purchases.C0.net), fmtKES(v.purchases.C0.tax)] });
        rows.push({ id: "p-ex", cells: ["Exempt", fmtKES(v.purchases.A_EXEMPT.net), fmtKES(v.purchases.A_EXEMPT.tax)] });

        rows.push({ id: "net", cells: ["Net VAT Due", "", fmtKES(v.netVatDue)], isHeader: true, isBold: true });

      } else if (type === "general-ledger" && accountId) {
        title = "General Ledger";
        subtitle = `From ${from} to ${to}`;
        columns = [
          { header: "Date", align: "left", widthPct: 15 },
          { header: "Details", align: "left", widthPct: 45 },
          { header: "Debit", align: "right", widthPct: 20 },
          { header: "Credit", align: "right", widthPct: 20 },
        ];
        const gl = await generalLedger(Number(accountId), from, to);
        let tDeb = 0;
        let tCred = 0;
        gl.forEach(l => {
          tDeb += l.debitCents;
          tCred += l.creditCents;
          rows.push({
            id: `gl-${l.entryId}-${l.debitCents}`,
            cells: [
              l.date,
              l.memo || l.lineMemo || l.sourceType,
              l.debitCents ? fmtKES(l.debitCents) : "-",
              l.creditCents ? fmtKES(l.creditCents) : "-"
            ]
          });
        });
        rows.push({ id: "tot", cells: ["Total", "", fmtKES(tDeb), fmtKES(tCred)], isHeader: true, isBold: true });

      } else if (type === "income-expense") {
        title = "Income vs Expense";
        subtitle = `Last 12 months`;
        columns = [
          { header: "Month", align: "left", widthPct: 40 },
          { header: "Income", align: "right", widthPct: 20 },
          { header: "Expense", align: "right", widthPct: 20 },
          { header: "Net", align: "right", widthPct: 20 },
        ];
        const rowsData = await monthlyIncomeExpense(12);
        rowsData.forEach(r => {
          const net = r.incomeCents - r.expenseCents;
          rows.push({
            id: r.month,
            cells: [r.label, fmtKES(r.incomeCents), fmtKES(r.expenseCents), fmtKES(net)]
          });
        });

      } else if (type === "cash-flow") {
        title = "Cash Flow Statement";
        subtitle = `As of ${asOf}`;
        columns = [
          { header: "Activity", align: "left", widthPct: 70 },
          { header: "Amount", align: "right", widthPct: 30 },
        ];
        const balances = await accountBalances({ to: asOf });
        
        const operating = balances.filter(b => b.type === "income" || b.type === "expense");
        const netOp = operating.filter(b => b.type === "income").reduce((s, b) => s + b.balanceCents, 0) - operating.filter(b => b.type === "expense").reduce((s, b) => s + b.balanceCents, 0);
        
        const investing = balances.filter(b => b.type === "asset" && b.subtype === "fixed_asset");
        const netInv = -investing.reduce((s, b) => s + b.balanceCents, 0);

        const financing = balances.filter(b => b.type === "equity" || b.type === "liability");
        const netFin = financing.reduce((s, b) => s + b.balanceCents, 0);

        const netCash = netOp + netInv + netFin;

        rows.push({ id: "op-h", cells: ["Operating Activities"], isHeader: true });
        rows.push({ id: "op-n", cells: ["Net Income / Operations", fmtKES(netOp)] });
        rows.push({ id: "op-t", cells: ["Net Cash from Operating Activities", fmtKES(netOp)], isBold: true });

        rows.push({ id: "inv-h", cells: ["Investing Activities"], isHeader: true });
        rows.push({ id: "inv-n", cells: ["Fixed Assets", fmtKES(netInv)] });
        rows.push({ id: "inv-t", cells: ["Net Cash from Investing Activities", fmtKES(netInv)], isBold: true });

        rows.push({ id: "fin-h", cells: ["Financing Activities"], isHeader: true });
        rows.push({ id: "fin-n", cells: ["Liabilities & Equity", fmtKES(netFin)] });
        rows.push({ id: "fin-t", cells: ["Net Cash from Financing Activities", fmtKES(netFin)], isBold: true });

        rows.push({ id: "net", cells: ["Net Change in Cash", fmtKES(netCash)], isHeader: true, isBold: true });

      } else {
        return new NextResponse("Report type not supported for PDF", { status: 400 });
      }

      const stream = await renderToStream(
        <ReportPdf
          title={title}
          subtitle={subtitle}
          orgName={org.name}
          brandColor={org.brandColor}
          logoUrl={org.logoUrl}
          dateStr={todayISO()}
          columns={columns}
          rows={rows}
        />
      );

      const headers = new Headers();
      headers.set("Content-Type", "application/pdf");
      if (download) {
        headers.set("Content-Disposition", `attachment; filename="${type}-report-${todayISO()}.pdf"`);
      } else {
        headers.set("Content-Disposition", `inline; filename="${type}-report-${todayISO()}.pdf"`);
      }

      return new NextResponse(stream as any, { headers });
    } catch (error: any) {
      console.error("PDF generation failed:", error);
      return new NextResponse("PDF generation failed: " + error.message, { status: 500 });
    }
  });
}
