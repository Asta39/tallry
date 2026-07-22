"use client";

import { useState, useTransition } from "react";
import { createWarehouseAction, renameWarehouseAction, setDefaultWarehouseAction, archiveWarehouseAction } from "@/lib/warehouses";

type Warehouse = { id: number; name: string; isDefault: boolean; archived: boolean };

const inputCls = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-accent-500)] focus:ring-2 focus:ring-[var(--color-accent-100)] transition-all";

function AddForm() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try { await createWarehouseAction(name); setName(""); window.location.reload(); }
          catch (e: any) { setError(e.message || "Could not create warehouse"); }
        });
      }}
      className="card p-4 flex flex-wrap items-end gap-3"
    >
      <label className="flex-1 min-w-[200px]">
        <span className="text-[12px] font-medium text-[var(--color-ink-600)]">Warehouse name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Mombasa Store, Nairobi Warehouse" className={inputCls + " w-full mt-1"} />
      </label>
      <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-60 text-white text-[13px] font-medium px-4 py-2 transition-colors">
        {pending ? "Adding…" : "Add warehouse"}
      </button>
      {error && <p className="w-full text-[12.5px] text-[var(--color-bad)]">{error}</p>}
    </form>
  );
}

function Row({ w }: { w: Warehouse }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(w.name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing) {
    return (
      <tr className="hairline-t">
        <td colSpan={3} className="px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <button
              disabled={pending}
              onClick={() => startTransition(async () => {
                try { await renameWarehouseAction(w.id, name); window.location.reload(); }
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
    <tr className={`hairline-t ${w.archived ? "opacity-50" : ""}`}>
      <td className="px-4 py-2.5 text-[13px] font-medium">
        {w.name}
        {w.isDefault && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-accent-600)]">default</span>}
        {w.archived && <span className="ml-2 text-[10px] uppercase tracking-wide text-[var(--color-bad)]">archived</span>}
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-[12px] font-medium text-[var(--color-ink-600)] hover:underline mr-3">Rename</button>
        {!w.isDefault && !w.archived && (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => {
              try { await setDefaultWarehouseAction(w.id); window.location.reload(); }
              catch (e: any) { setError(e.message); }
            })}
            className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline mr-3 disabled:opacity-50"
          >
            Make default
          </button>
        )}
        {!w.isDefault && (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => {
              try { await archiveWarehouseAction(w.id, !w.archived); window.location.reload(); }
              catch (e: any) { setError(e.message); }
            })}
            className={`text-[12px] font-medium hover:underline disabled:opacity-50 ${w.archived ? "text-[var(--color-good)]" : "text-[var(--color-bad)]"}`}
          >
            {w.archived ? "Restore" : "Archive"}
          </button>
        )}
        {error && <div className="text-[11.5px] text-[var(--color-bad)] mt-1">{error}</div>}
      </td>
    </tr>
  );
}

export function WarehousesClient({ warehouses }: { warehouses: Warehouse[] }) {
  return (
    <div className="space-y-4">
      <AddForm />
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="hairline-b">
            <tr>
              <th className="px-4 py-2.5 text-[11.5px] font-medium text-[var(--color-ink-400)] uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => <Row key={w.id} w={w} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
