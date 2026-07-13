import { NextResponse } from "next/server";
import { db, org, documents, contacts, portalOtps, portalSessions, reminderLog } from "@/db";
import { and, eq, lt, inArray, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email/resend";
import InvoiceReminder from "@/lib/email/templates/InvoiceReminder";
import { fmtKES } from "@/lib/money";

export const dynamic = "force-dynamic";

// Overdue reminder cadence (days past due). One email per stage per invoice.
const REMINDER_STAGES = [1, 7, 14];

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // 1. Purge expired portal auth artifacts
    const [otps, sessions] = await Promise.all([
      db.delete(portalOtps).where(lt(portalOtps.expiresAt, now)).returning({ id: portalOtps.id }),
      db.delete(portalSessions).where(lt(portalSessions.expiresAt, now)).returning({ id: portalSessions.id }),
    ]);

    // 2. Overdue invoice reminders
    const overdue = await db
      .select({
        id: documents.id,
        orgId: documents.orgId,
        number: documents.number,
        dueDate: documents.dueDate,
        totalCents: documents.totalCents,
        paidCents: documents.paidCents,
        contactId: documents.contactId,
      })
      .from(documents)
      .where(and(
        eq(documents.type, "invoice"),
        inArray(documents.status, ["open", "partial"]),
        sql`${documents.dueDate} IS NOT NULL AND ${documents.dueDate} < ${today}`,
      ));

    let sent = 0;
    for (const inv of overdue) {
      if (!inv.dueDate || !inv.contactId) continue;
      const daysOverdue = Math.floor(
        (Date.parse(today) - Date.parse(inv.dueDate)) / 86400_000
      );
      const stage = REMINDER_STAGES.filter((s) => daysOverdue >= s).pop();
      if (!stage) continue;
      const kind = `overdue_${stage}`;

      // Claim before sending — unique (document_id, kind) makes this idempotent
      const [claimed] = await db.insert(reminderLog)
        .values({ orgId: inv.orgId, documentId: inv.id, kind, sentAt: now })
        .onConflictDoNothing({ target: [reminderLog.documentId, reminderLog.kind] })
        .returning({ id: reminderLog.id });
      if (!claimed) continue;

      const [contact] = await db.select().from(contacts)
        .where(and(eq(contacts.id, inv.contactId), eq(contacts.orgId, inv.orgId)));
      if (!contact?.email) continue;
      const [o] = await db.select().from(org).where(eq(org.id, inv.orgId));

      await sendEmail({
        to: contact.email,
        subject: `Reminder: Invoice ${inv.number} is overdue — ${o?.name ?? ""}`,
        react: InvoiceReminder({
          customerName: contact.displayName || "Customer",
          orgName: o?.name ?? "Your supplier",
          invoiceNumber: inv.number,
          amountDue: fmtKES(inv.totalCents - inv.paidCents),
          dueDate: inv.dueDate,
          daysOverdue,
        }),
      }).catch((e) => console.error("Reminder email failed:", inv.id, e));
      sent++;
    }

    return NextResponse.json({
      success: true,
      purgedOtps: otps.length,
      purgedSessions: sessions.length,
      remindersSent: sent,
    });
  } catch (error) {
    console.error("Cron daily error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
