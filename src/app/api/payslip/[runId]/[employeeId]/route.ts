import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payrollRunLineItems, employees, payrollRuns } from "@/db";
import { and, eq } from "drizzle-orm";
import { renderToStream } from "@react-pdf/renderer";
import { PayslipPdf, PdfPayslipData } from "@/lib/pdf/PayslipPdf";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ runId: string; employeeId: string }> }) {
  try {
    const params = await props.params;
    await requirePerm("accountant");
    const o = await getOrg();
    const runId = parseInt(params.runId, 10);
    const employeeId = parseInt(params.employeeId, 10);

    const [emp] = await db.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.orgId, o.id)));
    const [run] = await db.select().from(payrollRuns).where(and(eq(payrollRuns.id, runId), eq(payrollRuns.orgId, o.id)));

    if (!emp || !run) {
      return new NextResponse("Payslip not found", { status: 404 });
    }

    const items = await db.select().from(payrollRunLineItems).where(
      and(eq(payrollRunLineItems.payrollRunId, runId), eq(payrollRunLineItems.employeeId, employeeId))
    );

    if (items.length === 0) {
      return new NextResponse("Payslip not found", { status: 404 });
    }

    const lines: { label: string; amountCents: number; isDeduction: boolean }[] = [];
    let gross = 0;
    let net = 0;

    for (const item of items) {
      if (item.type === "gross_pay") gross += item.amountCents;
      if (item.type === "net_pay") net += item.amountCents;
      
      if (item.type !== "net_pay") {
        let label = "Other";
        if (item.type === "gross_pay") label = "Basic Salary";
        else if (item.subType === "PAYE") label = "PAYE (Tax)";
        else if (item.subType === "NSSF") label = "NSSF (Pension)";
        else if (item.subType === "SHIF") label = "SHIF (Health)";
        else if (item.subType === "AHL") label = "Affordable Housing Levy";
        else if (item.subType === "loan") label = "Loan Repayment";
        else if (item.subType === "adjustment") label = "Adjustment";
        else if (item.subType) label = item.subType;

        lines.push({
          label,
          amountCents: item.amountCents,
          isDeduction: item.isDeduction
        });
      }
    }

    const pdfData: PdfPayslipData = {
      orgName: o.name,
      brandColor: o.brandColor,
      month: run.month,
      employeeName: emp.name,
      kraPin: emp.kraPin,
      nssfNumber: emp.nssfNumber,
      shifNumber: emp.shifNumber,
      lines,
      grossPayCents: gross,
      netPayCents: net,
    };

    const stream = await renderToStream(React.createElement(PayslipPdf, { data: pdfData }) as any);
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Payslip_${emp.name.replace(/\s+/g, '_')}_${run.month}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
