"use client";

import { useState, useTransition } from "react";
import { createCostCenterAction, updateCostCenterAction, toggleCostCenterActiveAction } from "@/lib/cost-centers";

type CostCenter = { id: number; name: string; code: string | null; active: boolean };

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

function AddForm() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await createCostCenterAction({ name, code: code || undefined });
            setName("");
            setCode("");
            window.location.reload();
          } catch (e: any) {
            setError(e.message || "Could not create cost center");
          }
        });
      }}
      className="card p-4 flex flex-wrap items-end gap-3"
    >
      <label className="flex-1 min-w-[180px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Nairobi Branch, Marketing, Project Alpha" className={inputCls + " w-full mt-1"} />
      </label>
      <label className="w-32">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Code (optional)</span>
        <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls + " w-full mt-1"} />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
        {pending ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-[12.5px] text-[var(--color-bad)]">{error}</p>}
    </form>
  );
}

function Row({ c }: { c: CostCenter }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [code, setCode] = useState(c.code || "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr className="hairline-t">
        <td colSpan={3} className="px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="code" className={inputCls + " w-28"} />
            <button
              disabled={pending}
              onClick={() => startTransition(async () => {
                try { await updateCostCenterAction(c.id, { name, code: code || undefined }); window.location.reload(); }
                catch (e: any) { setError(e.message); }
              })}
              className="text-[12.5px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-[12.5px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
            {error && <span className="text-[12px] text-[var(--color-bad)]">{error}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`hairline-t ${!c.active ? "opacity-50" : ""}`}>
      <td className="px-4 py-2.5 text-[13px] tnum text-[var(--color-ink-400)]">{c.code || "—"}</td>
      <td className="px-3 py-2.5 text-[13px] font-medium">
        {c.name}
        {!c.active && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-bad)]">inactive</span>}
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-[12px] font-medium text-[var(--color-ink-600)] hover:underline mr-3">Edit</button>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await toggleCostCenterActiveAction(c.id, !c.active); window.location.reload(); })}
          className={`text-[12px] font-medium hover:underline disabled:opacity-50 ${c.active ? "text-[var(--color-bad)]" : "text-[var(--color-good)]"}`}
        >
          {c.active ? "Deactivate" : "Activate"}
        </button>
      </td>
    </tr>
  );
}

export function CostCentersClient({ costCenters }: { costCenters: CostCenter[] }) {
  return (
    <div className="space-y-4">
      <AddForm />
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Code</th>
              <th className="px-3 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {costCenters.map((c) => <Row key={c.id} c={c} />)}
            {costCenters.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-400)] text-[13px]">No cost centers yet — add one above to start tagging transactions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
