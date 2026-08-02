"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createItemGroupAction,
  renameItemGroupAction,
  deleteItemGroupAction,
} from "@/lib/item-groups";

type Group = { id: number; name: string; itemCount: number };

export function ItemGroupsClient({ groups, canManage, enabled }: { groups: Group[]; canManage: boolean; enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function run(fn: () => Promise<unknown>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const input =
    "rounded-lg border border-[var(--color-ink-200)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--color-accent-500)]";

  if (!canManage) {
    return (
      <div className="card p-6 max-w-2xl text-[13px] text-[var(--color-ink-600)]">
        Only the owner or an admin can manage item groups.
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className={`rounded-xl border px-4 py-3 text-[12.5px] ${enabled ? "border-[var(--color-accent-100)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)]" : "border-[var(--color-ink-200)] bg-white text-[var(--color-ink-600)]"}`}>
        {enabled
          ? "Item groups are currently required for new items and any purchase line added into the Items list."
          : "Item groups are currently optional. You can build them here before turning the requirement on in Settings."}
      </div>

      <div className="card p-4 flex gap-3 items-center">
        <input
          className={input + " flex-1"}
          placeholder="New group name, e.g. Electronics, Raw Materials, Services"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              run(async () => {
                await createItemGroupAction(newName);
                setNewName("");
              });
            }
          }}
        />
        <button
          disabled={pending || !newName.trim()}
          onClick={() =>
            run(async () => {
              await createItemGroupAction(newName);
              setNewName("");
            })
          }
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 whitespace-nowrap"
        >
          Add group
        </button>
      </div>

      {error && <div className="text-[13px] text-[var(--color-bad)]">{error}</div>}

      <div className="card overflow-hidden">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
            No item groups yet. Add one above to start organizing your items.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="hairline-t first:border-t-0">
                  <td className="px-4 py-3">
                    {editing === g.id ? (
                      <input
                        className={input}
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            run(async () => {
                              await renameItemGroupAction(g.id, editName);
                              setEditing(null);
                            });
                          } else if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <span className="font-medium">{g.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[var(--color-ink-400)]">
                    {g.itemCount} item{g.itemCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing === g.id ? (
                      <>
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await renameItemGroupAction(g.id, editName);
                              setEditing(null);
                            })
                          }
                          className="text-[var(--color-accent-600)] font-medium mr-3"
                        >
                          Save
                        </button>
                        <button onClick={() => setEditing(null)} className="text-[var(--color-ink-400)]">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditing(g.id);
                            setEditName(g.name);
                          }}
                          className="text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mr-3"
                        >
                          Rename
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => {
                            if (confirm(g.itemCount > 0 ? `Delete "${g.name}"? Move its items to another group first.` : `Delete "${g.name}"?`)) {
                              run(() => deleteItemGroupAction(g.id));
                            }
                          }}
                          className="text-[var(--color-bad)] hover:opacity-80"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
