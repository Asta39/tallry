"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtKES } from "@/lib/money";
import { parseMpesaStatement, importMpesaTransactions } from "@/lib/mpesa-actions";
import type { MpesaTxn } from "@/lib/mpesa-pdf";

/**
 * M-Pesa PDF statement importer. User uploads the Safaricom statement PDF and
 * enters the ID-number password; server decrypts, parses, flags duplicates.
 * Already-imported receipts are unticked by default so re-uploading a newer
 * statement only adds the new transactions.
 */
export function MpesaImport({ banks }: { banks: { id: number; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [bankId, setBankId] = useState<number>(
    banks.find((b) => /m-?pesa/i.test(b.label))?.id ?? banks[0]?.id ?? 0
  );
  const [password, setPassword] = useState("");
  const [fileB64, setFileB64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [txns, setTxns] = useState<MpesaTxn[] | null>(null);
  const [dupes, setDupes] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null); setResult(null); setTxns(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    // base64 encode
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    setFileB64(btoa(binary));
  }

  function parse() {
    if (!fileB64) return setError("Choose your M-Pesa PDF first.");
    setError(null); setResult(null);
    start(async () => {
      const res = await parseMpesaStatement(fileB64, password);
      if (!res.ok || !res.txns) { setError(res.error ?? "Could not read the statement."); return; }
      const d = new Set(res.duplicateReceipts ?? []);
      setDupes(d);
      setTxns(res.txns);
      // pre-tick only the non-duplicate rows
      setPicked(new Set(res.txns.map((_, i) => i).filter((i) => !d.has(res.txns![i].receipt))));
    });
  }

  function toggle(i: number) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  }

  function runImport() {
    if (!txns) return;
    const chosen = txns.filter((_, i) => picked.has(i));
    if (chosen.length === 0) return setError("Nothing selected.");
    start(async () => {
      try {
        const res = await importMpesaTransactions(bankId, chosen);
        setResult(`✓ Imported ${res.created} transactions${res.skipped ? ` · ${res.skipped} already there` : ""}. Categorize them below.`);
        setTxns(null); setFileB64(null); setFileName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  const selectedTotal = txns ? txns.filter((_, i) => picked.has(i)).reduce((s, t) => s + t.amountCents, 0) : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[13px] font-medium">Import M-Pesa statement (PDF)</span>
        <span className="text-[11.5px] text-[var(--color-ink-400)]">
          The statement Safaricom emails you — password is your ID number
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
        <label className="block">
          <span className="text-[12px] text-[var(--color-ink-600)]">Into account</span>
          <select
            value={bankId}
            onChange={(e) => setBankId(Number(e.target.value))}
            className="w-full mt-1 rounded-md border border-[var(--color-ink-200)] px-2 py-2 text-[13px] bg-white"
          >
            {banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-[var(--color-ink-600)]">PDF file</span>
          <input type="file" accept="application/pdf,.pdf" onChange={onFile} className="w-full mt-1 text-[12px]" />
        </label>
        <label className="block">
          <span className="text-[12px] text-[var(--color-ink-600)]">Password (ID number)</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full mt-1 rounded-md border border-[var(--color-ink-200)] px-3 py-2 text-[13px] bg-white"
          />
        </label>
        <button
          onClick={parse}
          disabled={pending || !fileB64}
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
        >
          {pending && !txns ? "Reading…" : "Read statement"}
        </button>
      </div>
      {fileName && <div className="mt-1.5 text-[11.5px] text-[var(--color-ink-400)]">{fileName}</div>}

      {error && <div className="mt-3 text-[12.5px] text-[var(--color-bad)]">{error}</div>}
      {result && <div className="mt-3 text-[12.5px] text-[var(--color-good)] font-medium">{result}</div>}

      {txns && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12.5px] text-[var(--color-ink-600)]">
              {txns.length} found · {picked.size} selected · net {fmtKES(selectedTotal, { signed: true })}
              {dupes.size > 0 && <span className="text-[var(--color-ink-400)]"> · {dupes.size} already imported (unticked)</span>}
            </div>
            <button
              onClick={() => setPicked(new Set(txns.map((_, i) => i)))}
              className="text-[12px] text-[var(--color-accent-600)] font-medium"
            >
              Select all
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-ink-100)]">
            <table className="w-full text-[12px]">
              <tbody>
                {txns.map((t, i) => {
                  const dup = dupes.has(t.receipt);
                  return (
                    <tr key={i} className="border-b border-[var(--color-ink-100)] last:border-0">
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="accent-[var(--color-accent-500)]" />
                      </td>
                      <td className="px-2 py-1.5 text-[var(--color-ink-400)] whitespace-nowrap">{t.date}</td>
                      <td className="px-2 py-1.5">
                        {t.details.slice(0, 60)}
                        {dup && <span className="ml-1 text-[10px] text-[var(--color-warn)]">already imported</span>}
                      </td>
                      <td className={`px-2 py-1.5 text-right tnum whitespace-nowrap ${t.amountCents < 0 ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}`}>
                        {fmtKES(t.amountCents, { signed: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={runImport}
            disabled={pending || picked.size === 0}
            className="mt-3 rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2"
          >
            {pending ? "Importing…" : `Import ${picked.size} transactions`}
          </button>
        </div>
      )}
    </div>
  );
}
