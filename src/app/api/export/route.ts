import { withOrg } from "@/lib/org";
import { NextRequest } from "next/server";
import { accountBalances, profitAndLoss, vatReturn, withholdingTaxReport } from "@/lib/reports";
import { db, documents, contacts } from "@/db";
import { eq, and } from "drizzle-orm";
import { currentOrgId } from "@/lib/org";

function csv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r.map((c) => (typeof c === "string" && /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")
    )
    .join("\n");
}

const money = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const report = sp.get("report") ?? "trial-balance";
  const from = sp.get("from") ?? "2000-01-01";
  const to = sp.get("to") ?? "2100-01-01";

  let rows: (string | number)[][] = [];
  if (report === "trial-balance") {
    rows = [["Code", "Account", "Type", "Debits", "Credits", "Balance"]];
    for (const r of await withOrg(() => accountBalances({ to }))) {
      // Net balance in the account's normal-side column, not the raw
      // cumulative debitCents/creditCents — see trial-balance/page.tsx for
      // why the gross totals can never actually flag an out-of-balance book.
      const debitNature = r.type === "asset" || r.type === "expense";
      const netDebit = debitNature ? Math.max(r.balanceCents, 0) : Math.max(-r.balanceCents, 0);
      const netCredit = debitNature ? Math.max(-r.balanceCents, 0) : Math.max(r.balanceCents, 0);
      if (!netDebit && !netCredit) continue;
      rows.push([r.code, r.name, r.type, money(netDebit), money(netCredit), money(r.balanceCents)]);
    }
  } else if (report === "pnl") {
    const pl = await withOrg(() => profitAndLoss(from, to));
    rows = [["Section", "Account", "Amount"]];
    pl.income.forEach((r) => rows.push(["Income", r.name, money(r.balanceCents)]));
    pl.cogs.forEach((r) => rows.push(["COGS", r.name, money(r.balanceCents)]));
    pl.inventoryAdjustments.forEach((r) => rows.push(["Inventory Adjustments", r.name, money(r.balanceCents)]));
    pl.expenses.forEach((r) => rows.push(["Expenses", r.name, money(r.balanceCents)]));
    rows.push(["", "Gross profit", money(pl.grossProfit)]);
    rows.push(["", "Net profit", money(pl.netProfit)]);
  } else if (report === "vat") {
    const v = await withOrg(() => vatReturn(from, to));
    rows = [["Side", "Class", "Taxable value", "VAT"]];
    for (const [cls, x] of Object.entries(v.sales)) rows.push(["Sales", cls, money(x.net), money(x.tax)]);
    for (const [cls, x] of Object.entries(v.purchases)) rows.push(["Purchases", cls, money(x.net), money(x.tax)]);
    rows.push(["", "Net VAT due", "", money(v.netVatDue)]);
  } else if (report === "wht") {
    const w = await withOrg(() => withholdingTaxReport(from, to));
    rows = [["Date", "Payment #", "Invoice #", "Customer", "KRA PIN", "Gross", "WHT", "Net"]];
    for (const r of w.rows) {
      rows.push([r.date, r.paymentNumber, r.documentNumber ?? "", r.contactName ?? "", r.kraPin ?? "", money(r.grossCents), money(r.whtCents), money(r.netCents)]);
    }
    rows.push(["", "", "", "", "Total", money(w.totalGrossCents), money(w.totalWhtCents), money(w.totalNetCents)]);
  } else if (report === "invoices") {
    rows = [["Number", "Date", "Due", "Customer", "Status", "Subtotal", "VAT", "Total", "Paid"]];
    // Org-scoped — this previously queried across all tenants with no org filter.
    const { docs, cs } = await withOrg(async () => {
      const orgId = currentOrgId();
      return {
        docs: await db.select().from(documents).where(and(eq(documents.type, "invoice"), eq(documents.orgId, orgId))),
        cs: await db.select().from(contacts).where(eq(contacts.orgId, orgId)),
      };
    });
    for (const d of docs) {
      rows.push([
        d.number,
        d.date,
        d.dueDate ?? "",
        cs.find((c) => c.id === d.contactId)?.displayName ?? "",
        d.status,
        money(d.subtotalCents),
        money(d.taxCents),
        money(d.totalCents),
        money(d.paidCents),
      ]);
    }
  } else {
    return new Response("Unknown report", { status: 400 });
  }

  return new Response(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report}-${from}-${to}.csv"`,
    },
  });
}
