"use client";

import { useState, useTransition } from "react";
import { createItemTypeAction, updateItemTypeAction, deleteItemTypeAction } from "@/lib/item-types";

type ItemType = {
  id: number;
  name: string;
  isGroupMandatory: boolean;
  isSystem: boolean;
};

const input = "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

export function ItemTypesClient({ types }: { types: ItemType[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setIsMandatory(true);
    setAdding(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(t: ItemType) {
    setEditingId(t.id);
    setName(t.name);
    setIsMandatory(t.isGroupMandatory);
    setAdding(false);
    setError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (editingId) await updateItemTypeAction(editingId, name, isMandatory);
        else await createItemTypeAction(name, isMandatory);
        reset();
        window.location.reload();
      } catch (e: any) {
        setError(e.message || "Could not save item type");
      }
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this item type? This can't be undone.")) return;
    startTransition(async () => {
      try {
        await deleteItemTypeAction(id);
        window.location.reload();
      } catch (e: any) {
        alert(e.message || "Could not delete item type");
      }
    });
  }

  return (
    <div>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="hairline-b bg-[var(--color-ink-50)]">
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Name</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Item group required</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)] text-right w-32">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {types.map((t) =>
            editingId === t.id ? (
              <tr key={t.id}>
                <td colSpan={3} className="px-4 py-3 bg-[var(--color-ink-50)]">
                  <form onSubmit={handleSave} className="flex flex-wrap items-center gap-3">
                    <input
                      autoFocus
                      required
                      value={name}
                      disabled={t.isSystem}
                      onChange={(e) => setName(e.target.value)}
                      className={input + (t.isSystem ? " opacity-60" : "")}
                    />
                    <label className="flex items-center gap-2 text-[12px]">
                      <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="accent-[var(--color-accent-500)]" />
                      Item group required
                    </label>
                    <div className="ml-auto flex gap-3">
                      <button type="submit" disabled={pending} className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50">Save</button>
                      <button type="button" onClick={reset} className="text-[12px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
                    </div>
                  </form>
                  {error && <div className="text-[11.5px] text-[var(--color-bad)] mt-1.5">{error}</div>}
                </td>
              </tr>
            ) : (
              <tr key={t.id} className="hover:bg-[var(--color-ink-50)]/60">
                <td className="px-4 py-3 text-[var(--color-ink-900)] capitalize font-medium">{t.name}</td>
                <td className="px-4 py-3 text-[var(--color-ink-600)]">{t.isGroupMandatory ? "Yes" : "No"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-3">
                    <button onClick={() => startEdit(t)} className="text-[12px] font-medium text-[var(--color-accent-600)] hover:underline">
                      {t.isSystem ? "Edit requirement" : "Edit"}
                    </button>
                    {!t.isSystem && (
                      <button onClick={() => handleDelete(t.id)} disabled={pending} className="text-[12px] font-medium text-[var(--color-bad)] hover:underline disabled:opacity-50">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          )}

          {adding && (
            <tr>
              <td colSpan={3} className="px-4 py-3 bg-[var(--color-ink-50)]">
                <form onSubmit={handleSave} className="flex flex-wrap items-center gap-3">
                  <input
                    autoFocus
                    required
                    placeholder="e.g. Unprocessed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={input}
                  />
                  <label className="flex items-center gap-2 text-[12px]">
                    <input type="checkbox" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="accent-[var(--color-accent-500)]" />
                    Item group required
                  </label>
                  <div className="ml-auto flex gap-3">
                    <button type="submit" disabled={pending} className="text-[12px] font-medium text-[var(--color-good)] hover:underline disabled:opacity-50">Save</button>
                    <button type="button" onClick={reset} className="text-[12px] text-[var(--color-ink-400)] hover:underline">Cancel</button>
                  </div>
                </form>
                {error && <div className="text-[11.5px] text-[var(--color-bad)] mt-1.5">{error}</div>}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && !editingId && (
        <div className="p-4 hairline-t">
          <button
            onClick={() => { setAdding(true); setName(""); setIsMandatory(true); setError(null); }}
            className="text-[13px] font-medium text-[var(--color-accent-600)] hover:underline"
          >
            + New item type
          </button>
        </div>
      )}
    </div>
  );
}
