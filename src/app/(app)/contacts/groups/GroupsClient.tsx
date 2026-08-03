"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomerGroupAction,
  renameCustomerGroupAction,
  deleteCustomerGroupAction,
} from "@/lib/customer-groups";

type Group = { id: number; name: string; parentGroupId: number | null; memberCount: number };

/** Depth-first order so a group's subgroups render directly under it, indented — not scattered by alpha sort. */
function orderTree(groups: Group[]): { group: Group; depth: number }[] {
  const byParent = new Map<number | null, Group[]>();
  for (const g of groups) {
    const key = g.parentGroupId ?? null;
    const arr = byParent.get(key) ?? [];
    arr.push(g);
    byParent.set(key, arr);
  }
  const out: { group: Group; depth: number }[] = [];
  function walk(parentId: number | null, depth: number) {
    for (const g of byParent.get(parentId) ?? []) {
      out.push({ group: g, depth });
      walk(g.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

export function GroupsClient({ groups, canManage }: { groups: Group[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");

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
        Only the owner or an admin can manage customer groups.
      </div>
    );
  }

  const ordered = orderTree(groups);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input
          className={input + " flex-1 min-w-[180px]"}
          placeholder="New group name, e.g. Wholesale, Retail, NGOs"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              run(async () => {
                await createCustomerGroupAction(newName, newParentId ? Number(newParentId) : null);
                setNewName("");
                setNewParentId("");
              });
            }
          }}
        />
        <select className={input} value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
          <option value="">No parent (top-level)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button
          disabled={pending || !newName.trim()}
          onClick={() =>
            run(async () => {
              await createCustomerGroupAction(newName, newParentId ? Number(newParentId) : null);
              setNewName("");
              setNewParentId("");
            })
          }
          className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 whitespace-nowrap"
        >
          Add group
        </button>
      </div>
      <p className="text-[11.5px] text-[var(--color-ink-400)] -mt-2">
        Pick a parent to make this a subgroup — e.g. a "Nairobi Office" group with "Wholesale" and "Retail" subgroups inside it.
      </p>

      {error && <div className="text-[13px] text-[var(--color-bad)]">{error}</div>}

      <div className="card overflow-hidden">
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[var(--color-ink-400)]">
            No groups yet. Add one above — customers must belong to a group.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {ordered.map(({ group: g, depth }) => (
                <tr key={g.id} className="hairline-t first:border-t-0">
                  <td className="px-4 py-3" style={depth > 0 ? { paddingLeft: 16 + depth * 20 } : undefined}>
                    {editing === g.id ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          className={input}
                          value={editName}
                          autoFocus
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <select className={input} value={editParentId} onChange={(e) => setEditParentId(e.target.value)}>
                          <option value="">No parent (top-level)</option>
                          {groups.filter((og) => og.id !== g.id).map((og) => (
                            <option key={og.id} value={og.id}>{og.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="font-medium">{depth > 0 ? "↳ " : ""}{g.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[var(--color-ink-400)] whitespace-nowrap">
                    {g.memberCount} customer{g.memberCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing === g.id ? (
                      <>
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await renameCustomerGroupAction(g.id, editName, editParentId ? Number(editParentId) : null);
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
                            setEditParentId(g.parentGroupId ? String(g.parentGroupId) : "");
                          }}
                          className="text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mr-3"
                        >
                          Rename / move
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                g.memberCount > 0
                                  ? `Delete "${g.name}"? Its ${g.memberCount} customer(s) will become ungrouped, and any subgroups will move to top-level.`
                                  : `Delete "${g.name}"? Any subgroups will move to top-level.`
                              )
                            ) {
                              run(() => deleteCustomerGroupAction(g.id));
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
