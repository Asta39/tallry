import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";
import { getOrg } from "@/lib/org";
import { db, payslips, employees, payrollRuns } from "@/db";
import { and, eq } from "drizzle-orm";
import { renderToStream } from "@react-pdf/renderer";
import { PayslipPdf, PdfPayslipData } from "@/lib/pdf/PayslipPdf";
import React from "react";

export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await requirePerm("accountant");
    const o = await getOrg();
    const slipId = parseInt(params.id, 10);

    const [data] = await db
      .select({
        slip: payslips,
        employeeName: employees.name,
        kraPin: employees.kraPin,
        nssfNumber: employees.nssfNumber,
        shifNumber: employees.shifNumber,
        month: payrollRuns.month,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .innerJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .where(and(eq(payslips.id, slipId), eq(payslips.orgId, o.id)));

    if (!data) {
      return new NextResponse("Payslip not found", { status: 404 });
    }

    const pdfData: PdfPayslipData = {
      orgName: o.name,
      brandColor: o.brandColor,
      month: data.month,
      employeeName: data.employeeName,
      kraPin: data.kraPin,
      nssfNumber: data.nssfNumber,
      shifNumber: data.shifNumber,
      grossPayCents: data.slip.grossPayCents,
      nssfCents: data.slip.nssfCents,
      shifCents: data.slip.shifCents,
      housingLevyCents: data.slip.housingLevyCents,
      payeCents: data.slip.payeCents,
      netPayCents: data.slip.netPayCents,
    };

    const stream = await renderToStream(React.createElement(PayslipPdf, { data: pdfData }));
    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Payslip_${data.employeeName.replace(/\s+/g, '_')}_${data.month}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
