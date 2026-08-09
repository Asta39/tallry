import { NextResponse } from "next/server";
import { reconcileUnconfirmedKopoKopoPayouts } from "@/lib/payments/webhook";
import { logCronRun } from "@/lib/cron-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const result = await reconcileUnconfirmedKopoKopoPayouts();

    await logCronRun(
      "reconcile-payouts",
      "success",
      `${result.checked} checked, ${result.confirmed} confirmed, ${result.reversed} reversed, ${result.stillPending} still pending, ${result.errors} errors`,
      Date.now() - started
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Cron reconcile-payouts error:", error);
    await logCronRun("reconcile-payouts", "error", String(error), Date.now() - started);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
