"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES, parseKES, todayISO } from "@/lib/money";
import { SearchableSelect } from "@/components/SearchableSelect";
import { computeDocument, TAX_CLASSES, type TaxClass } from "@/lib/tax";
import {
  saveRecurringTemplate,
  setRecurringActive,
  deleteRecurringTemplate,
  runDueRecurring,
} from "@/lib/phase-a-actions";
import { FREQUENCIES, type Frequency } from "@/lib/recurring";
import type { DocLineInput } from "@/lib/actions";
import { StatusPill } from "@/components/ui";

type Option = { id: number; label: string };

export interface RecurringRow {
  id: number;
  name: string;
  docType: string;
  contactName: string | null;
  frequency: string;
  nextRunDate: string;
  autoIssue: boolean;
  active: boolean;
  totalCents: number;
  lastRunAt: string | null;
}

interface FormLine {
  description: string;
  qty: string;
  price: string;
  taxClass: TaxClass;
}

const emptyLine = (): FormLine => ({ description: "", qty: "1", price: "", taxClass: "B16" });

export function RecurringManager({
  rows,
  customers,
  vendors,
  bankAccounts,
  dueCount,
}: {
  rows: RecurringRow[];
  customers: Option[];
  vendors: Option[];
  bankAccounts: Option[];
  dueCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(rows.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [docType, setDocType] = useState<"invoice" | "bill" | "expense">("invoice");
  const [contactId, setContactId] = useState<number | "">("");
  const [paidFrom, setPaidFrom] = useState<number | "">(bankAccounts[0]?.id ?? "");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [nextRun, setNextRun] = useState(todayISO());
  const [dueInDays, setDueInDays] = useState("30");
  const [autoIssue, setAutoIssue] = useState(false);
  const [lines, setLines] = useState<FormLine[]>([emptyLine()]);

  const contacts = docType === "invoice" ? customers : vendors;

  const parsedLines: DocLineInput[] = lines
    .filter((l) => l.description && parseKES(l.price) > 0)
    .map((l) => ({
      description: l.description,
      qty: Number(l.qty) || 1,
      unitPriceCents: parseKES(l.price) || 0,
      discountPct: 0,
      taxClass: l.taxClass,
    }));
  const totals = computeDocument(
    parsedLines.map((l) => ({ qty: l.qty, unitPriceCents: l.unitPriceCents, discountPct: 0, taxClass: l.taxClass })),
    false
  );

  function submit() {
    setError(null);
    start(async () => {
      try {
        await saveRecurringTemplate({
          name,
          docType,
          contactId: contactId === "" ? null : contactId,
          paidFromBankAccountId: paidFrom === "" ? null : paidFrom,
          frequency,
          nextRunDate: nextRun,
          dueInDays: Number(dueInDays) || 30,
          taxInclusive: false,
          autoIssue,
          lines: parsedLines,
        });
        setShowForm(false);
        setName(""); setLines([emptyLine()]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function runNow() {
    setNotice(null);
    start(async () => {
      const res = await runDueRecurring();
      setNotice(res.created > 0 ? `✓ Created ${res.created} document(s) from due templates.` : "Nothing due today.");
      router.refresh();
    });
  }

  const input =
    "w-full rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)] mt-1";
  const label = "text-[12px] font-medium text-[var(--color-ink-600)]";
  const cell =
    "w-full rounded-md border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] bg-transparent px-2 py-1.5 text-[13px] outline-none";

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] text-white text-[13px] font-medium px-4 py-2"
        >
          {showForm ? "Close form" : "+ New recurring template"}
        </button>
        <button
          onClick={runNow}
          disabled={pending}
          className="rounded-lg border border-[var(--color-ink-200)] bg-white hover:bg-[var(--color-ink-50)] text-[13px] font-medium px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Running…" : `Run due now${dueCount ? ` (${dueCount})` : ""}`}
        </button>
        {notice && <span className="text-[12.5px] text-[var(--color-good)] font-medium">{notice}</span>}
      </div>

      {showForm && (
        <div className="card p-5 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="block sm:col-span-2">
              <span className={label}>Template name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. Monthly retainer — Acme" />
            </label>
            <label className="block">
              <span className={label}>Creates a…</span>
              <select value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)} className={input}>
                <option value="invoice">Invoice (money in)</option>
                <option value="bill">Bill (money owed out)</option>
                <option value="expense">Expense (paid immediately)</option>
              </select>
            </label>
            {docType !== "expense" ? (
              <label className="block">
                <span className={label}>{docType === "invoice" ? "Customer" : "Vendor"}</span>
                <SearchableSelect
                  options={contacts}
                  value={contactId}
                  onChange={setContactId}
                  placeholder={docType === "invoice" ? "Search customers…" : "Search vendors…"}
                />
              </label>
            ) : (
              <label className="block">
                <span className={label}>Paid from</span>
                <select value={paidFrom} onChange={(e) => setPaidFrom(e.target.value ? Number(e.target.value) : "")} className={input}>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className={label}>Repeats</span>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={input}>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>First run date</span>
              <input type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} className={input} />
            </label>
            {docType !== "expense" && (
              <label className="block">
                <span className={label}>Due in (days)</span>
                <input value={dueInDays} onChange={(e) => setDueInDays(e.target.value)} className={input} />
              </label>
            )}
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={autoIssue} onChange={(e) => setAutoIssue(e.target.checked)} className="accent-[var(--color-accent-500)]" />
              <span className="text-[12.5px] text-[var(--color-ink-600)]">
                Issue automatically (off = create as draft for review)
              </span>
            </label>
          </div>

          <div className="mt-4 rounded-lg border border-[var(--color-ink-100)] overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead className="hairline-b">
                <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
                  <th className="text-left px-3 py-2 font-semibold w-[45%]">Description</th>
                  <th className="text-right px-2 py-2 font-semibold w-[10%]">Qty</th>
                  <th className="text-right px-2 py-2 font-semibold w-[18%]">Price (KSh)</th>
                  <th className="text-left px-2 py-2 font-semibold w-[20%]">VAT</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="hairline-t">
                    <td className="px-2 py-1.5">
                      <input className={cell} placeholder="e.g. Office rent — July" value={l.description}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input className={`${cell} text-right`} value={l.qty}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                    </td>
                    <td className="px-1 py-1.5">
                      <input className={`${cell} text-right`} placeholder="0.00" value={l.price}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    </td>
                    <td className="px-1 py-1.5">
                      <select className={cell} value={l.taxClass}
                        onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, taxClass: e.target.value as TaxClass } : x)))}>
                        {Object.entries(TAX_CLASSES).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="pr-2">
                      <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="text-[var(--color-ink-200)] hover:text-[var(--color-bad)]">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="hairline-t px-3 py-2 flex items-center justify-between">
              <button onClick={() => setLines((ls) => [...ls, emptyLine()])} className="text-[13px] font-medium text-[var(--color-accent-600)]">
                + Add line
              </button>
              <span className="text-[13px] tnum">
                Total per run: <b>{fmtKES(totals.totalCents)}</b>
              </span>
            </div>
          </div>

          {error && <div className="mt-3 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
          <button
            onClick={submit}
            disabled={pending}
            className="mt-4 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-5 py-2.5"
          >
            {pending ? "Saving…" : "Save template"}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card px-6 py-10 text-center text-[13px] text-[var(--color-ink-400)]">
          No recurring templates yet — set up rent, retainers or subscriptions once and let them create themselves.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="hairline-b">
              <tr className="text-[11.5px] uppercase tracking-wide text-[var(--color-ink-400)]">
                <th className="text-left px-4 py-2.5 font-semibold">Template</th>
                <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                <th className="text-left px-4 py-2.5 font-semibold">Contact</th>
                <th className="text-left px-4 py-2.5 font-semibold">Repeats</th>
                <th className="text-left px-4 py-2.5 font-semibold">Next run</th>
                <th className="text-right px-4 py-2.5 font-semibold">Per run</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hairline-t">
                  <td className="px-4 py-3 text-[13px] font-medium">
                    {r.name}
                    {r.autoIssue && <span className="ml-2 text-[10.5px] text-[var(--color-accent-600)] font-semibold">AUTO-ISSUE</span>}
                  </td>
                  <td className="px-4 py-3 text-[13px] capitalize">{r.docType}</td>
                  <td className="px-4 py-3 text-[13px]">{r.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-[13px] capitalize">{r.frequency}</td>
                  <td className="px-4 py-3 text-[13px] tnum">{r.nextRunDate}</td>
                  <td className="px-4 py-3 text-[13px] tnum text-right">{fmtKES(r.totalCents)}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await setRecurringActive(r.id, !r.active);
                          router.refresh();
                        })
                      }
                    >
                      <StatusPill status={r.active ? "paid" : "draft"} />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          if (!confirm(`Delete template "${r.name}"? Already-created documents stay.`)) return;
                          await deleteRecurringTemplate(r.id);
                          router.refresh();
                        })
                      }
                      className="text-[12px] text-[var(--color-ink-400)] hover:text-[var(--color-bad)]"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
