import { NextResponse } from "next/server";
import { runAllOrgBackups } from "@/lib/org-backup";
import { logCronRun } from "@/lib/cron-log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { orgsBackedUp, failures } = await runAllOrgBackups();
    const status = failures.length > 0 ? "error" : "success";
    const detail = failures.length > 0
      ? `${orgsBackedUp} backed up, ${failures.length} failed: ${failures.map((f) => `org ${f.orgId} (${f.error})`).join("; ")}`
      : `${orgsBackedUp} org(s) backed up`;

    await logCronRun("org-backups", status, detail, Date.now() - started);
    return NextResponse.json({ success: failures.length === 0, orgsBackedUp, failures });
  } catch (error) {
    console.error("Cron org-backups error:", error);
    await logCronRun("org-backups", "error", String(error), Date.now() - started);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
