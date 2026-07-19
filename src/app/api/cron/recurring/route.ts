import { NextResponse } from "next/server";
import { runDueRecurring } from "@/lib/phase-a-actions";
import { db, org } from "@/db";
import { orgContext } from "@/lib/org";
import { logCronRun } from "@/lib/cron-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const orgs = await db.select({ id: org.id }).from(org);
    let totalCreated = 0;

    for (const o of orgs) {
      await orgContext.run(o.id, async () => {
        const { created } = await runDueRecurring();
        totalCreated += created;
      });
    }

    await logCronRun("recurring", "success", `${totalCreated} document(s) created across ${orgs.length} org(s)`, Date.now() - started);
    return NextResponse.json({ success: true, created: totalCreated });
  } catch (error) {
    console.error("Cron recurring error:", error);
    await logCronRun("recurring", "error", String(error), Date.now() - started);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
