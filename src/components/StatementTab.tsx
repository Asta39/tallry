import { fmtKES } from "@/lib/money";
import { TableCard, Th, Td, PrimaryLink } from "@/components/ui";

export function StatementTab({
  contact,
  docs,
  pays,
  portalSlug,
}: {
  contact: any;
  docs: any[];
  pays: any[];
  portalSlug?: string;
}) {
  // Build a chronological ledger
  const ledger: {
    id: string;
    date: string;
    type: "invoice" | "payment";
    description: string;
    amountCents: number;
  }[] = [];

  for (const d of docs) {
    if (d.type === "invoice" && !["draft", "void"].includes(d.status)) {
      ledger.push({
        id: `doc-${d.id}`,
        date: d.date,
        type: "invoice",
        description: `Invoice ${d.number}`,
        amountCents: d.totalCents,
      });
    }
  }

  for (const p of pays) {
    ledger.push({
      id: `pay-${p.id}`,
      date: p.date,
      type: "payment",
      description: `Payment ${p.number}`,
      amountCents: -p.amountCents, // Payments reduce balance
    });
  }

  // Sort by date, then by type (invoice first, then payment if same date)
  ledger.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.type === b.type) return 0;
    return a.type === "invoice" ? -1 : 1;
  });

  let runningBalance = 0;
  const ledgerWithBalance = ledger.map((item) => {
    runningBalance += item.amountCents;
    return { ...item, balance: runningBalance };
  });

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[15px] font-semibold">Account Statement</h2>
        <div className="flex gap-2">
          <a
            href={portalSlug ? `/portal/${portalSlug}/api/statement/pdf/${contact.id}` : `/api/statement/pdf/${contact.id}`}
            target="_blank"
            className="flex items-center gap-1 rounded-md border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--color-ink-50)] transition-colors"
          >
            <span className="opacity-70">📄</span> View PDF
          </a>
          <a
            href={portalSlug ? `/portal/${portalSlug}/api/statement/pdf/${contact.id}?download=1` : `/api/statement/pdf/${contact.id}?download=1`}
            className="flex items-center gap-1 rounded-md bg-[var(--color-ink-900)] text-white px-3 py-1.5 text-[12px] font-medium hover:bg-black transition-colors"
          >
            ↓ Download
          </a>
        </div>
      </div>

      {ledgerWithBalance.length === 0 ? (
        <div className="card px-5 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No invoices or payments to show.
        </div>
      ) : (
        <TableCard>
          <thead className="hairline-b">
            <tr>
              <Th>Date</Th>
              <Th>Details</Th>
              <Th right>Amount</Th>
              <Th right>Balance</Th>
            </tr>
          </thead>
          <tbody>
            {ledgerWithBalance.map((item) => (
              <tr key={item.id} className="hairline-t">
                <Td className="text-[var(--color-ink-400)]">{item.date}</Td>
                <Td className="font-medium">{item.description}</Td>
                <Td right className={item.type === "payment" ? "text-[var(--color-good)]" : ""}>
                  {fmtKES(item.amountCents)}
                </Td>
                <Td right className="font-medium">
                  {fmtKES(item.balance)}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </>
  );
}
