import { db, documents, documentLines, contacts, payments, bankAccounts, paymentGateways } from "@/db";
import { and, eq } from "drizzle-orm";
import { getOrg } from "@/lib/org";
import { getAccess } from "@/lib/access";
import { notFound } from "next/navigation";
import { fmtKES, todayISO } from "@/lib/money";
import { TAX_CLASSES, type TaxClass } from "@/lib/tax";
import { PageHeader, StatusPill, Th, Td } from "@/components/ui";
import { DocActions } from "@/components/DocActions";
import { ETIMS_ENABLED } from "@/lib/features";

const typeLabels: Record<string, string> = {
  invoice: "Invoice",
  quote: "Quote",
  credit_note: "Credit note",
  bill: "Bill",
  expense: "Expense",
  purchase_order: "Purchase order",
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  accountant: "Accountant",
  sales: "Sales",
  hr: "HR",
  inventory: "Inventory",
  staff: "Staff",
};

export async function DocDetail({ id, printHref }: { id: number; printHref?: string }) {
  const org = await getOrg();
  const orgId = org.id;
  const [doc] = await db.select().from(documents).where(and(eq(documents.orgId, orgId), eq(documents.id, id))).limit(1);
  if (!doc) notFound();
  const lines = await db.select().from(documentLines).where(and(eq(documentLines.orgId, orgId), eq(documentLines.documentId, id)));
  const contact = doc.contactId
    ? (await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.id, doc.contactId))).limit(1))[0]
    : null;
  const pays = await db.select().from(payments).where(and(eq(payments.orgId, orgId), eq(payments.documentId, id)));
  const banks = await db.select().from(bankAccounts).where(eq(bankAccounts.orgId, orgId));
  const gateways = await db.select().from(paymentGateways).where(and(eq(paymentGateways.orgId, orgId), eq(paymentGateways.enabled, true)));
  const access = await getAccess();
  const canApprove = !!access?.perms.has("accountant");

  return (
    <>
      <PageHeader
        title={`${typeLabels[doc.type] ?? doc.type} ${doc.number}`}
        subtitle={
          [
            contact?.displayName,
            doc.date,
            doc.createdByName ? `Created by ${doc.createdByName}${doc.createdByRole ? ` (${roleLabels[doc.createdByRole] || doc.createdByRole})` : ""}` : null,
          ].filter(Boolean).join(" · ")
        }
        action={
          <StatusPill
            status={doc.status}
            overdue={(doc.status === "open" || doc.status === "partial") && !!doc.dueDate && doc.dueDate < todayISO()}
          />
        }
      />

      <DocActions
        doc={{
          id: doc.id,
          type: doc.type,
          status: doc.status,
          totalCents: doc.totalCents,
          paidCents: doc.paidCents,
        }}
        bankAccounts={banks.map((b) => ({ id: b.id, label: b.name }))}
        printHref={printHref}
        gateways={gateways.map(g => ({ id: g.gatewayId, name: g.gatewayId === "mpesa_daraja" ? "M-Pesa Daraja" : "Kopo Kopo" }))}
        contactPhone={contact?.phone || ""}
        canApprove={canApprove}
      />

      {doc.approvalNote && doc.status === "draft" && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-[13px] text-[var(--color-bad)]">
          <span className="font-medium">Rejected: </span>{doc.approvalNote}
        </div>
      )}

      <div className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="hairline-b">
            <tr>
              <Th>Description</Th>
              <Th right>Qty</Th>
              <Th right>Price</Th>
              <Th>VAT</Th>
              <Th right>Net</Th>
              <Th right>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              if (org.customDocumentColumnName) {
                const grouped = new Map<string, typeof lines>();
                for (const l of lines) {
                  const cat = l.customColumnValue || "Uncategorized";
                  if (!grouped.has(cat)) grouped.set(cat, []);
                  grouped.get(cat)!.push(l);
                }
                const elements = [];
                for (const [cat, catLines] of grouped.entries()) {
                  elements.push(
                    <tr key={`cat-${cat}`} className="hairline-t bg-[var(--color-ink-50)]">
                      <td colSpan={6} className="px-4 py-2 text-[13px] font-semibold text-[var(--color-ink-900)]">
                        {cat}
                      </td>
                    </tr>
                  );
                  for (const l of catLines) {
                    elements.push(
                      <tr key={l.id} className="hairline-t">
                        <Td>{l.description}</Td>
                        <Td right>{l.qty}</Td>
                        <Td right>{fmtKES(l.unitPriceCents)}</Td>
                        <Td className="text-[var(--color-ink-400)]">
                          {TAX_CLASSES[l.taxClass as TaxClass]?.label ?? l.taxClass}
                        </Td>
                        <Td right>{fmtKES(l.netCents)}</Td>
                        <Td right className="font-medium">{fmtKES(l.grossCents)}</Td>
                      </tr>
                    );
                  }
                }
                return <>{elements}</>;
              }

              return lines.map((l) => (
                <tr key={l.id} className="hairline-t">
                  <Td>{l.description}</Td>
                  <Td right>{l.qty}</Td>
                  <Td right>{fmtKES(l.unitPriceCents)}</Td>
                  <Td className="text-[var(--color-ink-400)]">
                    {TAX_CLASSES[l.taxClass as TaxClass]?.label ?? l.taxClass}
                  </Td>
                  <Td right>{fmtKES(l.netCents)}</Td>
                  <Td right className="font-medium">{fmtKES(l.grossCents)}</Td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
        <div className="hairline-t px-5 py-4 flex justify-end">
          <div className="w-64 space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[var(--color-ink-600)]">Subtotal</span>
              <span className="tnum">{fmtKES(doc.subtotalCents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-ink-600)]">VAT</span>
              <span className="tnum">{fmtKES(doc.taxCents)}</span>
            </div>
            <div className="flex justify-between font-semibold text-[15px] pt-1 hairline-t mt-1">
              <span>Total</span>
              <span className="tnum">{fmtKES(doc.totalCents)}</span>
            </div>
            {(doc.paidCents > 0 || doc.creditedCents > 0) && (
              <>
                {doc.paidCents > 0 && (
                  <div className="flex justify-between text-[var(--color-good)]">
                    <span>Paid</span>
                    <span className="tnum">−{fmtKES(doc.paidCents)}</span>
                  </div>
                )}
                {doc.creditedCents > 0 && (
                  <div className="flex justify-between text-[var(--color-good)]">
                    <span>Credited</span>
                    <span className="tnum">−{fmtKES(doc.creditedCents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Balance due</span>
                  <span className="tnum">{fmtKES(doc.totalCents - doc.paidCents - doc.creditedCents)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {ETIMS_ENABLED && doc.cuInvoiceNumber && (
        <div className="card mt-4 px-5 py-3.5 text-[12.5px] text-[var(--color-ink-600)] flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="font-medium text-[var(--color-ink-900)]">KRA eTIMS</span>
          <span>CU Invoice No: <span className="tnum font-medium">{doc.cuInvoiceNumber}</span></span>
          <span>CU Serial: <span className="tnum">{doc.cuSerial}</span></span>
          <span className="text-[var(--color-warn)]">Simulated device — not fiscally valid</span>
        </div>
      )}

      {pays.length > 0 && (
        <>
          <h2 className="text-[15px] font-semibold mt-7 mb-3">Payments</h2>
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="hairline-b">
                <tr>
                  <Th>Date</Th>
                  <Th>Number</Th>
                  <Th>Method</Th>
                  <Th>Reference</Th>
                  <Th right>WHT</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id} className="hairline-t">
                    <Td className="text-[var(--color-ink-400)]">{p.date}</Td>
                    <Td>{p.number}</Td>
                    <Td className="capitalize">{p.method}</Td>
                    <Td>{p.reference ?? "—"}</Td>
                    <Td right>{p.whtCents ? fmtKES(p.whtCents) : "—"}</Td>
                    <Td right className="font-medium">{fmtKES(p.amountCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {doc.notes && (
        <p className="mt-5 text-[13px] text-[var(--color-ink-600)] whitespace-pre-wrap">{doc.notes}</p>
      )}
    </>
  );
}
