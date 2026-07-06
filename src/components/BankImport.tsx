"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importBankTransactions } from "@/lib/actions";
import { fmtKES, parseKES } from "@/lib/money";

interface ParsedRow {
  date: string;
  description: string;
  amountCents: number;
}

/**
 * CSV statement import. Handles common Kenyan formats:
 * - bank exports with Date / Description / Amount (signed) columns
 * - bank exports with separate Debit ("Withdrawn") / Credit ("Paid In") columns
 * - M-Pesa statement exports (Completion Time, Details, Withdrawn, Paid In)
 * Header names are matched loosely; dates normalized to YYYY-MM-DD.
 */
function parseCsv(text: string): ParsedRow[] {
  // Split respecting quoted fields
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const header = split(lines[0]).map((h) => h.toLowerCase());
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const iDate = find("date", "completion time", "time");
  const iDesc = find("description", "details", "narration", "particulars", "reference");
  const iAmount = find("amount");
  const iDebit = find("withdrawn", "debit", "money out", "paid out");
  const iCredit = find("paid in", "credit", "money in", "deposit");
  if (iDate < 0 || (iAmount < 0 && iDebit < 0 && iCredit < 0)) return [];

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const rawDate = cells[iDate] ?? "";
    const date = normalizeDate(rawDate);
    if (!date) continue;
    let amountCents = 0;
    if (iAmount >= 0 && cells[iAmount]) {
      amountCents = parseKES(cells[iAmount]) || 0;
    } else {
      const debit = iDebit >= 0 ? Math.abs(parseKES(cells[iDebit] ?? "") || 0) : 0;
      const credit = iCredit >= 0 ? Math.abs(parseKES(cells[iCredit] ?? "") || 0) : 0;
      amountCents = credit - debit;
    }
    if (!amountCents) continue;
    rows.push({
      date,
      description: (iDesc >= 0 ? cells[iDesc] : "") || "Imported transaction",
      amountCents,
    });
  }
  return rows;
}

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  // YYYY-MM-DD (possibly with time)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY (Kenyan convention)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function BankImport({ banks }: { banks: { id: number; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [bankId, setBankId] = useState<number>(banks[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setDone(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = parseCsv(await file.text());
    if (parsed.length === 0) {
      setError("Couldn't find transactions. Need columns like Date, Description, Amount (or Withdrawn / Paid In).");
      setRows(null);
      return;
    }
    setRows(parsed);
  }

  const total = (rows ?? []).reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[13px] font-medium">Import statement (CSV)</span>
        <select
          value={bankId}
          onChange={(e) => setBankId(Number(e.target.value))}
          className="rounded-md border border-[var(--color-ink-200)] px-2 py-1.5 text-[13px] bg-white"
        >
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-[12.5px]" />
        <span className="text-[11.5px] text-[var(--color-ink-400)]">
          Works with bank exports and M-Pesa statements
        </span>
      </div>

      {error && <div className="mt-3 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
      {done !== null && (
        <div className="mt-3 text-[12.5px] text-[var(--color-good)] font-medium">
          ✓ Imported {done} transactions — categorize them below to book them.
        </div>
      )}

      {rows && (
        <div className="mt-4">
          <div className="text-[12.5px] text-[var(--color-ink-600)] mb-2">
            {rows.length} transactions found · net {fmtKES(total, { signed: true })}
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--color-ink-100)]">
            <table className="w-full text-[12px]">
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-ink-100)] last:border-0">
                    <td className="px-3 py-1.5 text-[var(--color-ink-400)] whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-1.5">{r.description.slice(0, 80)}</td>
                    <td className={`px-3 py-1.5 text-right tnum whitespace-nowrap ${r.amountCents < 0 ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}`}>
                      {fmtKES(r.amountCents, { signed: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-3">
            <button
              disabled={pending || !bankId}
              onClick={() =>
                start(async () => {
                  try {
                    const n = await importBankTransactions(bankId, rows);
                    setDone(n);
                    setRows(null);
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Import failed");
                  }
                })
              }
              className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
            >
              {pending ? "Importing…" : `Import ${rows.length} transactions`}
            </button>
            <button
              onClick={() => setRows(null)}
              className="text-[13px] text-[var(--color-ink-400)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
