import { redirect } from "next/navigation";
import { getAccess, MODULES } from "@/lib/access";
import { listAuditLog, listAuditActors } from "@/lib/audit";
import { PageHeader, TableCard, Th, Td, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  issue: "Issued",
  void: "Voided",
  approve: "Approved",
  reject: "Rejected",
  accepted: "Accepted",
  declined: "Declined",
  convert_from_quote: "Converted from quote",
  receive: "Payment received",
  pay_out: "Payment sent",
};

const MODULE_LABELS: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const access = await getAccess();
  if (!access) redirect("/login");
  // Admin-only, deliberately not a toggleable module perm — an org owner
  // should never be able to grant a staff role visibility into who-did-what.
  if (!access.isOwner && access.role !== "admin") redirect("/");

  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const filters = {
    from: str(sp.from),
    to: str(sp.to),
    module: str(sp.module),
    action: str(sp.action),
    actorMemberId: str(sp.actor) ? Number(str(sp.actor)) : undefined,
    q: str(sp.q),
  };

  const [{ rows, total }, actors] = await Promise.all([
    listAuditLog(access.orgId, filters, page, PAGE_SIZE),
    listAuditActors(access.orgId),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, actor: filters.actorMemberId ?? "", page, ...overrides })) {
      if (v !== undefined && v !== "" && v !== null) params.set(k, String(v));
    }
    return `?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every action taken in this organization — who, when, what, and on which record. Visible to admins only."
        action={
          <a
            href={`/api/pdf/audit-log${qs({ page: 1 })}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-ink-900)] text-white text-[13px] font-medium hover:opacity-90"
          >
            Export PDF
          </a>
        }
      />

      <form method="get" className="card p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">From</span>
          <input type="date" name="from" defaultValue={filters.from} className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]" />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">To</span>
          <input type="date" name="to" defaultValue={filters.to} className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]" />
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">Module</span>
          <select name="module" defaultValue={filters.module} className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]">
            <option value="">All modules</option>
            {MODULES.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">Action</span>
          <select name="action" defaultValue={filters.action} className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]">
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">Staff member</span>
          <select name="actor" defaultValue={String(filters.actorMemberId ?? "")} className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]">
            <option value="">Everyone</option>
            {actors.map((a) => (
              <option key={a.actorMemberId ?? "owner"} value={a.actorMemberId ?? ""}>{a.actorName}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[11.5px] font-medium text-[var(--color-ink-500)]">Search</span>
          <input type="text" name="q" defaultValue={filters.q} placeholder="Record, note…" className="mt-1 w-full rounded-lg border border-[var(--color-ink-200)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]" />
        </label>
        <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex gap-2 pt-1">
          <button type="submit" className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2">
            Apply filters
          </button>
          <a href="/settings/audit-logs" className="text-[13px] text-[var(--color-ink-400)] self-center">Clear</a>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No activity found" body="Nothing matches these filters yet." />
      ) : (
        <>
          <TableCard>
            <thead>
              <tr className="border-b border-[var(--color-ink-100)]">
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Module</Th>
                <Th>Record</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-[var(--color-ink-500)]">{r.createdAt.replace("T", " ").slice(0, 19)}</Td>
                  <Td>
                    <div className="font-medium">{r.actorName}</div>
                    <div className="text-[11.5px] text-[var(--color-ink-400)] capitalize">{r.actorRole}</div>
                  </Td>
                  <Td>{ACTION_LABELS[r.action] ?? r.action}</Td>
                  <Td>{MODULE_LABELS[r.module] ?? r.module}</Td>
                  <Td>{r.recordLabel ?? (r.recordId ? `#${r.recordId}` : "—")}</Td>
                  <Td className="text-[var(--color-ink-500)] max-w-xs truncate">{r.detail ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </TableCard>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-[13px] text-[var(--color-ink-500)]">
              <span>Page {page} of {totalPages} · {total} entries</span>
              <div className="flex gap-2">
                {page > 1 && <a href={qs({ page: page - 1 })} className="px-3 py-1.5 rounded-lg border border-[var(--color-ink-200)] hover:bg-[var(--color-ink-50)]">Previous</a>}
                {page < totalPages && <a href={qs({ page: page + 1 })} className="px-3 py-1.5 rounded-lg border border-[var(--color-ink-200)] hover:bg-[var(--color-ink-50)]">Next</a>}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
