import { NextResponse } from "next/server";
import { runAndStoreAllOrgChecks } from "@/lib/ledger-integrity";
import { logCronRun } from "@/lib/cron-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { orgsChecked, totalFindings } = await runAndStoreAllOrgChecks();

    await logCronRun("ledger-integrity", "success", `${totalFindings} open finding(s) across ${orgsChecked} org(s)`, Date.now() - started);
    return NextResponse.json({ success: true, findings: totalFindings, orgsChecked });
  } catch (error) {
    console.error("Cron ledger-integrity error:", error);
    await logCronRun("ledger-integrity", "error", String(error), Date.now() - started);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
