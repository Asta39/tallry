"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { computeDocument, TAX_CLASSES, type TaxClass } from "@/lib/tax";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import { saveDocument, issueDocument, type DocLineInput } from "@/lib/actions";

type Option = { id: number; label: string };
type ItemOption = {
  id: number;
  name: string;
  salePriceCents: number;
  purchaseCostCents: number;
  taxClass: string;
  unit: string;
};

interface EditorLine {
  itemId: number | null;
  description: string;
  qty: string;
  price: string; // user-facing KES string
  discountPct: string;
  taxClass: TaxClass;
  accountId: number | null;
}

const emptyLine = (): EditorLine => ({
  itemId: null,
  description: "",
  qty: "1",
  price: "",
  discountPct: "0",
  taxClass: "B16",
  accountId: null,
});

export function DocumentEditor({
  type,
  contacts,
  items,
  expenseAccounts,
  bankAccounts,
  backHref,
  detailHref,
}: {
  type: "invoice" | "quote" | "credit_note" | "bill" | "expense" | "purchase_order";
  contacts: Option[];
  items: ItemOption[];
  expenseAccounts?: Option[];
  bankAccounts?: Option[];
  backHref: string;
  /** e.g. "/sales/invoices" — new doc id is appended */
  detailHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isSale = type === "invoice" || type === "quote" || type === "credit_note";
  const isExpense = type === "expense";
  const [contactId, setContactId] = useState<number | "">("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [notes, setNotes] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [paidFrom, setPaidFrom] = useState<number | "">("");
  const [lines, setLines] = useState<EditorLine[]>([emptyLine()]);

  const parsedLines: DocLineInput[] = useMemo(
    () =>
      lines
        .filter((l) => l.description || l.itemId || parseKES(l.price) > 0)
        .map((l) => ({
          itemId: l.itemId,
          description: l.description || "Item",
          qty: Number(l.qty) || 1,
          unitPriceCents: Number.isNaN(parseKES(l.price)) ? 0 : parseKES(l.price),
          discountPct: Number(l.discountPct) || 0,
          taxClass: l.taxClass,
          accountId: l.accountId,
        })),
    [lines]
  );

  const totals = useMemo(
    () =>
      computeDocument(
        parsedLines.map((l) => ({
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          discountPct: l.discountPct,
          taxClass: l.taxClass,
        })),
        taxInclusive
      ),
    [parsedLines, taxInclusive]
  );

  function update(i: number, patch: Partial<EditorLine>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function pickItem(i: number, itemId: number) {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    update(i, {
      itemId,
      description: it.name,
      price: ((isSale ? it.salePriceCents : it.purchaseCostCents || it.salePriceCents) / 100).toFixed(2),
      taxClass: (it.taxClass as TaxClass) ?? "B16",
    });
  }

  async function submit(issue: boolean) {
    setError(null);
    if (parsedLines.length === 0) return setError("Add at least one line.");
    if (!isExpense && !contactId) return setError(isSale ? "Choose a customer." : "Choose a vendor.");
    if (isExpense && !paidFrom) return setError("Choose the account you paid from.");
    startTransition(async () => {
      try {
        const id = await saveDocument({
          type,
          contactId: contactId === "" ? null : contactId,
          date,
          dueDate: dueDate || null,
          taxInclusive,
          notes: notes || undefined,
          billNumber: billNumber || undefined,
          paidFromBankAccountId: paidFrom === "" ? null : paidFrom,
          lines: parsedLines,
        });
        if (issue) await issueDocument(id);
        router.push(detailHref ? `${detailHref}/${id}` : backHref);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)]";
  const cellCls =
    "w-full rounded-md border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] bg-transparent px-2 py-1.5 text-[13px] outline-none";

  return (
    <div className="space-y-5">
      {/* Header fields */}
      <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!isExpense && (
          <label className="block col-span-2">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
              {isSale ? "Customer" : "Vendor"}
            </span>
            <select
              className={inputCls + " mt-1"}
              value={contactId}
              onChange={(e) => setContactId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {isExpense && (
          <label className="block col-span-2">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Paid from</span>
            <select
              className={inputCls + " mt-1"}
              value={paidFrom}
              onChange={(e) => setPaidFrom(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose account…</option>
              {bankAccounts?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Date</span>
          <input type="date" className={inputCls + " mt-1"} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {(type === "invoice" || type === "bill") && (
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Due date</span>
            <input type="date" className={inputCls + " mt-1"} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        )}
        {(type === "bill" || type === "expense") && (
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--color-ink-600)]">
              {type === "bill" ? "Vendor's invoice no." : "Reference"}
            </span>
            <input className={inputCls + " mt-1"} value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="optional" />
          </label>
        )}
        <label className="flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            checked={taxInclusive}
            onChange={(e) => setTaxInclusive(e.target.checked)}
            className="accent-[var(--color-accent-500)]"
          />
          <span className="text-[12.5px] text-[var(--color-ink-600)]">Prices include VAT</span>
        </label>
      </div>

      {/* Lines */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="hairline-b">
            <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
              <th className="text-left px-4 py-2.5 font-semibold w-[34%]">Item / description</th>
              <th className="text-right px-2 py-2.5 font-semibold w-[8%]">Qty</th>
              <th className="text-right px-2 py-2.5 font-semibold w-[13%]">Price (KSh)</th>
              <th className="text-right px-2 py-2.5 font-semibold w-[9%]">Disc %</th>
              <th className="text-left px-2 py-2.5 font-semibold w-[13%]">VAT</th>
              {(type === "bill" || type === "expense") && (
                <th className="text-left px-2 py-2.5 font-semibold w-[15%]">Category</th>
              )}
              <th className="text-right px-4 py-2.5 font-semibold w-[13%]">Amount</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const t = totals.lines[parsedLines.findIndex((_, pi) => pi === i)] ?? null;
              return (
                <tr key={i} className="hairline-t align-top">
                  <td className="px-3 py-2">
                    {items.length > 0 && (
                      <select
                        className={cellCls + " text-[var(--color-ink-400)] mb-1"}
                        value={l.itemId ?? ""}
                        onChange={(e) => e.target.value && pickItem(i, Number(e.target.value))}
                      >
                        <option value="">— pick an item —</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      className={cellCls}
                      placeholder="Description"
                      value={l.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      className={cellCls + " text-right"}
                      value={l.qty}
                      onChange={(e) => update(i, { qty: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      className={cellCls + " text-right"}
                      placeholder="0.00"
                      value={l.price}
                      onChange={(e) => update(i, { price: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <input
                      className={cellCls + " text-right"}
                      value={l.discountPct}
                      onChange={(e) => update(i, { discountPct: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <select
                      className={cellCls}
                      value={l.taxClass}
                      onChange={(e) => update(i, { taxClass: e.target.value as TaxClass })}
                    >
                      {Object.entries(TAX_CLASSES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(type === "bill" || type === "expense") && (
                    <td className="px-1 py-2">
                      <select
                        className={cellCls}
                        value={l.accountId ?? ""}
                        onChange={(e) =>
                          update(i, { accountId: e.target.value ? Number(e.target.value) : null })
                        }
                      >
                        <option value="">Misc. expense</option>
                        {expenseAccounts?.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-3.5 text-right text-[13px] tnum">
                    {t ? fmtKES(t.grossCents) : "—"}
                  </td>
                  <td className="pr-2 py-3">
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="text-[var(--color-ink-200)] hover:text-[var(--color-bad)] text-[15px]"
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="hairline-t px-4 py-2.5">
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, emptyLine()])}
            className="text-[13px] font-medium text-[var(--color-accent-600)] hover:text-[var(--color-accent-700)]"
          >
            + Add line
          </button>
        </div>
      </div>

      {/* Totals + notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Notes (shown on document)</span>
          <textarea
            className={inputCls + " mt-1 h-24 resize-none"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Payment terms, delivery details…"
          />
        </label>
        <div className="card px-5 py-4 self-start">
          <Row label="Subtotal (before VAT)" v={fmtKES(totals.subtotalCents)} />
          <Row label="VAT" v={fmtKES(totals.taxCents)} />
          <div className="hairline-t mt-2 pt-2 flex justify-between text-[15px] font-semibold">
            <span>Total</span>
            <span className="tnum">{fmtKES(totals.totalCents)}</span>
          </div>
        </div>
      </div>

      {error && <div className="text-[13px] text-[var(--color-bad)]">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => submit(true)}
          disabled={pending}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2.5 transition-colors"
        >
          {pending ? "Saving…" : issueLabel(type)}
        </button>
        <button
          onClick={() => submit(false)}
          disabled={pending}
          className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-5 py-2.5 transition-colors"
        >
          Save as draft
        </button>
        <a href={backHref} className="text-[13px] text-[var(--color-ink-400)] hover:text-[var(--color-ink-600)] ml-1">
          Cancel
        </a>
      </div>
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-[var(--color-ink-600)]">{label}</span>
      <span className="tnum">{v}</span>
    </div>
  );
}

function issueLabel(type: string) {
  switch (type) {
    case "invoice":
      return "Save & issue invoice";
    case "quote":
      return "Save & send quote";
    case "credit_note":
      return "Save & issue credit note";
    case "bill":
      return "Save & record bill";
    case "expense":
      return "Save expense";
    case "purchase_order":
      return "Save & send PO";
    default:
      return "Save & issue";
  }
}
