import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import { getStatementData } from "@/lib/phase-a-actions";
import { StatementPdf } from "@/lib/pdf/StatementPdf";
import { todayISO, addDays } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const dateTo = url.searchParams.get("to") || todayISO();
    const dateFrom = url.searchParams.get("from") || addDays(dateTo, -30);

    const data = await getStatementData(Number(id), dateFrom, dateTo);

    const stream = await renderToStream(StatementPdf(data));
    
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="statement-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Statement PDF error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
