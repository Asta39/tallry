import { db, cronRuns } from "@/db";

/** Record a cron job run. Never throws — logging must not fail the job. */
export async function logCronRun(job: string, status: "success" | "error", detail: string, durationMs: number) {
  try {
    await db.insert(cronRuns).values({
      job,
      status,
      detail,
      durationMs,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("cron log failed:", e);
  }
}
