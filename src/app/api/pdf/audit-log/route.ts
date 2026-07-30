import { NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { getAccess, MODULES } from "@/lib/access";
import { listAuditLog } from "@/lib/audit";
import { AuditLogPdf } from "@/lib/pdf/AuditLogPdf";

export const dynamic = "force-dynamic";

const MODULE_LABELS: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

const MAX_ROWS = 2000;

export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (!access) return new Response("Sign in required", { status: 401 });
  if (!access.isOwner && access.role !== "admin") return new Response("Admins only", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const filters = {
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    module: sp.get("module") || undefined,
    action: sp.get("action") || undefined,
    actorMemberId: sp.get("actor") ? Number(sp.get("actor")) : undefined,
    q: sp.get("q") || undefined,
  };

  const { rows, total } = await listAuditLog(access.orgId, filters, 1, MAX_ROWS);

  const filterParts: string[] = [];
  if (filters.from) filterParts.push(`From ${filters.from}`);
  if (filters.to) filterParts.push(`To ${filters.to}`);
  if (filters.module) filterParts.push(MODULE_LABELS[filters.module] ?? filters.module);
  if (filters.action) filterParts.push(filters.action);
  if (filters.q) filterParts.push(`"${filters.q}"`);
  const filterSummary = filterParts.length ? filterParts.join(" · ") : "All activity";

  const element = React.createElement(AuditLogPdf, {
    data: {
      orgName: access.orgRow.name,
      brandColor: access.orgRow.brandColor ?? "#0f766e",
      generatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
      filterSummary,
      totalCount: total,
      rows: rows.map((r) => ({
        createdAt: r.createdAt,
        actorName: r.actorName,
        actorRole: r.actorRole,
        action: r.action,
        module: MODULE_LABELS[r.module] ?? r.module,
        recordLabel: r.recordLabel ?? (r.recordId ? `#${r.recordId}` : "—"),
        detail: r.detail ?? "",
      })),
    },
  });

  const buffer = await renderToBuffer(element as React.ReactElement<import("@react-pdf/renderer").DocumentProps>);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Audit_Log_${access.orgRow.name.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}
