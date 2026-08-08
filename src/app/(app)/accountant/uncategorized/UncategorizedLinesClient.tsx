"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reclassLineAction } from "@/lib/reclass";
import { fmtKES } from "@/lib/money";

type Line = {
  lineId: number;
  documentId: number;
  docType: string;
  docNumber: string;
  docDate: string;
  description: string;
  netCents: number;
  costCenterId: number | null;
};
type Account = { id: number; code: string; name: string; type: string };
type CostCenter = { id: number; name: string };

const selectCls =
  "rounded-lg border border-[var(--color-ink-200)] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--color-accent-500)]";

function Row({ line, accounts, costCenters }: { line: Line; accounts: Account[]; costCenters: CostCenter[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [accountId, setAccountId] = useState<string>("");
  const [costCenterId, setCostCenterId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const wantIncome = line.docType === "invoice";
  const options = accounts.filter((a) => (wantIncome ? a.type === "income" : a.type === "expense"));

  if (done) return null;

  return (
    <tr className="hairline-t">
      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-ink-500)]">{line.docDate}</td>
      <td className="px-3 py-2.5 text-[13px] font-medium">{line.docNumber}</td>
      <td className="px-3 py-2.5 text-[12.5px] text-[var(--color-ink-600)]">{line.description}</td>
      <td className="px-3 py-2.5 text-[13px] tnum text-right">{fmtKES(line.netCents)}</td>
      <td className="px-3 py-2.5">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={selectCls}>
          <option value="">Pick a category…</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} className={selectCls}>
          <option value="">No cost center</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          disabled={pending || !accountId}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await reclassLineAction(line.lineId, Number(accountId), costCenterId ? Number(costCenterId) : null);
              if (res.error) setError(res.error);
              else {
                setDone(true);
                router.refresh();
              }
            })
          }
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[12.5px] font-medium px-3 py-1.5"
        >
          {pending ? "Fixing…" : "Fix"}
        </button>
        {error && <div className="text-[11.5px] text-[var(--color-bad)] mt-1">{error}</div>}
      </td>
    </tr>
  );
}

export function UncategorizedLinesClient({ lines, accounts, costCenters }: { lines: Line[]; accounts: Account[]; costCenters: CostCenter[] }) {
  if (lines.length === 0) {
    return <div className="card p-6 text-[13px] text-[var(--color-ink-500)]">Nothing uncategorized — every posted line has a real account.</div>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead className="hairline-b">
          <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-400)]">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Line</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Cost center</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <Row key={l.lineId} line={l} accounts={accounts} costCenters={costCenters} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
