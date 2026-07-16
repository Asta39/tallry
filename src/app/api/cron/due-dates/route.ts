import { NextResponse } from "next/server";
import { db, org, documents } from "@/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { addDays } from "@/lib/recurring";
import { todayISO } from "@/lib/money";
import { notifyOrg } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const orgs = await db.select({ id: org.id }).from(org);
    const today = todayISO();
    const in1Day = addDays(today, 1);
    const in3Days = addDays(today, 3);

    let totalAlerts = 0;

    for (const o of orgs) {
      // Find open invoices
      const invoices = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.orgId, o.id),
            eq(documents.type, "invoice"),
            inArray(documents.status, ["open", "partial"]),
            isNotNull(documents.dueDate)
          )
        );

      let dueToday = 0;
      let due1Day = 0;
      let due3Days = 0;

      for (const inv of invoices) {
        if (!inv.dueDate) continue;
        if (inv.dueDate === today) dueToday++;
        else if (inv.dueDate === in1Day) due1Day++;
        else if (inv.dueDate === in3Days) due3Days++;
      }

      if (dueToday > 0) {
        await notifyOrg(
          o.id,
          ["admin", "sales", "accountant"],
          "Invoices Due Today",
          `${dueToday} invoice(s) are due today.`,
          "/reports/aging"
        );
        totalAlerts++;
      }
      if (due1Day > 0) {
        await notifyOrg(
          o.id,
          ["admin", "sales"],
          "Invoices Due Tomorrow",
          `${due1Day} invoice(s) are due tomorrow.`,
          "/reports/aging"
        );
        totalAlerts++;
      }
      if (due3Days > 0) {
        await notifyOrg(
          o.id,
          ["admin", "sales"],
          "Invoices Due in 3 Days",
          `${due3Days} invoice(s) are approaching their due date.`,
          "/reports/aging"
        );
        totalAlerts++;
      }
    }

    return NextResponse.json({ success: true, alertsSent: totalAlerts });
  } catch (error) {
    console.error("Cron due-dates error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
