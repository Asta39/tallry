import { withOrg } from "@/lib/org";
import { requirePerm } from "@/lib/guard";
import { eq, and } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import Link from "next/link";
import { aging } from "@/lib/reports";
import { db, contacts } from "@/db";
import { fmtKES, todayISO } from "@/lib/money";
import { PageHeader, TableCard, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

const bucketLabels = [
  ["current", "Not yet due"],
  ["d1_30", "1–30 days late"],
  ["d31_60", "31–60 days"],
  ["d61_90", "61–90 days"],
  ["d90plus", "90+ days"],
] as const;

export default async function AgingPage() {
  await requirePerm("reports");
  const o = await getOrg();
  const today = todayISO();
  const ar = await withOrg(() => aging("invoice", today));
  const ap = await withOrg(() => aging("bill", today));
  const allContacts = await db.select().from(contacts).where(eq(contacts.orgId, o.id));
  const cname = (id: number | null) => allContacts.find((c) => c.id === id)?.displayName ?? "—";

  const Section = ({ title, data, href }: { title: string; data: typeof ar; href: (id: number) => string }) => (
    <div className="mb-8">
      <h2 className="text-[15px] font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-5 gap-3 mb-4">
        {bucketLabels.map(([k, label]) => (
          <div key={k} className="card px-4 py-3">
            <div className="text-[11.5px] text-[var(--color-ink-400)]">{label}</div>
            <div className={`text-[15px] font-semibold tnum mt-0.5 ${k !== "current" && data.buckets[k] > 0 ? "text-[var(--color-bad)]" : ""}`}>
              {fmtKES(data.buckets[k])}
            </div>
          </div>
        ))}
      </div>
      {data.rows.length > 0 && (
        <TableCard>
          <thead className="hairline-b">
            <tr><Th>Number</Th><Th>Contact</Th><Th>Due date</Th><Th right>Days late</Th><Th right>Balance</Th></tr>
          </thead>
          <tbody>
            {data.rows
              .sort((a, b) => b.daysOverdue - a.daysOverdue)
              .map((d) => (
                <tr key={d.id} className="hairline-t">
                  <Td>
                    <Link href={href(d.id)} className="font-medium hover:text-[var(--color-accent-600)]">{d.number}</Link>
                  </Td>
                  <Td>{cname(d.contactId)}</Td>
                  <Td className="text-[var(--color-ink-400)]">{d.dueDate ?? d.date}</Td>
                  <Td right className={d.daysOverdue > 0 ? "text-[var(--color-bad)] font-semibold" : ""}>
                    {d.daysOverdue || "—"}
                  </Td>
                  <Td right className="font-medium">{fmtKES(d.balanceCents)}</Td>
                </tr>
              ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Aging" subtitle="Chase the oldest first" />
      <Section title={`Money owed to you — ${fmtKES(ar.total)}`} data={ar} href={(id) => `/sales/invoices/${id}`} />
      <Section title={`Money you owe — ${fmtKES(ap.total)}`} data={ap} href={(id) => `/purchases/bills/${id}`} />
    </>
  );
}
