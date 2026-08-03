"use client";

import { useState } from "react";
import { saveItemType, deleteItemType } from "@/lib/actions";

export function ItemTypesClient({ types }: { types: any[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);

  function reset() {
    setName("");
    setIsMandatory(true);
    setAdding(false);
    setEditingId(null);
  }

  function startEdit(t: any) {
    if (t.isSystem) return;
    setEditingId(t.id);
    setName(t.name);
    setIsMandatory(t.isGroupMandatory);
    setAdding(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    if (editingId) fd.append("id", String(editingId));
    fd.append("name", name);
    if (isMandatory) fd.append("isGroupMandatory", "on");
    await saveItemType(fd);
    reset();
  }

  return (
    <div>
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-ink-50)]">
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Name</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)]">Item Group Mandatory</th>
            <th className="px-4 py-3 font-medium text-[var(--color-ink-500)] text-right w-24">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-ink-100)]">
          {types.map((t) => (
            <tr key={t.id} className="hover:bg-[var(--color-ink-50)] transition-colors">
              {editingId === t.id ? (
                <td colSpan={3} className="px-4 py-3">
                  <form onSubmit={handleSave} className="flex items-center gap-4">
                    <input
                      autoFocus
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-md border border-[var(--color-ink-200)] px-2 py-1 text-sm outline-none focus:border-blue-500"
                    />
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={(e) => setIsMandatory(e.target.checked)}
                      />
                      <span className="text-sm">Mandatory</span>
                    </label>
                    <div className="ml-auto flex gap-2">
                      <button type="submit" className="text-blue-600 hover:underline">Save</button>
                      <button type="button" onClick={reset} className="text-[var(--color-ink-500)] hover:underline">Cancel</button>
                    </div>
                  </form>
                </td>
              ) : (
                <>
                  <td className="px-4 py-3 text-[var(--color-ink-900)] capitalize">{t.name}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-600)]">{t.isGroupMandatory ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    {t.isSystem ? (
                      <span className="text-xs text-[var(--color-ink-400)] px-2">System</span>
                    ) : (
                      <div className="flex justify-end gap-3">
                        <button onClick={() => startEdit(t)} className="text-blue-600 hover:underline">Edit</button>
                        <form action={deleteItemType}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="text-red-600 hover:underline">Delete</button>
                        </form>
                      </div>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
          
          {adding && (
            <tr>
              <td colSpan={3} className="px-4 py-3 bg-[var(--color-ink-50)]">
                <form onSubmit={handleSave} className="flex items-center gap-4">
                  <input
                    autoFocus
                    required
                    placeholder="New type name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-md border border-[var(--color-ink-200)] px-2 py-1 text-sm outline-none focus:border-blue-500"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isMandatory}
                      onChange={(e) => setIsMandatory(e.target.checked)}
                    />
                    <span className="text-sm">Mandatory</span>
                  </label>
                  <div className="ml-auto flex gap-2">
                    <button type="submit" className="text-blue-600 hover:underline">Save</button>
                    <button type="button" onClick={reset} className="text-[var(--color-ink-500)] hover:underline">Cancel</button>
                  </div>
                </form>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      {!adding && (
        <div className="p-4 border-t border-[var(--color-ink-100)]">
          <button
            onClick={() => { setAdding(true); setName(""); setIsMandatory(true); }}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            + New Item Type
          </button>
        </div>
      )}
    </div>
  );
}
