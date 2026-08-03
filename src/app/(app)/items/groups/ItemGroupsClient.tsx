"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createItemGroupAction,
  renameItemGroupAction,
  deleteItemGroupAction,
} from "@/lib/item-groups";

type Group = { id: number; name: string; parentGroupId: number | null; appliesTo: string; itemCount: number };
type ItemTypeOption = { name: string };

function appliesToLabel(appliesTo: string): string {
  if (appliesTo === "both") return "All item types";
  return `${appliesTo.charAt(0).toUpperCase() + appliesTo.slice(1)} only`;
}

/** Depth-first order so a group's subgroups render directly under it, indented. */
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

export function ItemGroupsClient({ groups, types, canManage, enabled }: { groups: Group[]; types: ItemTypeOption[]; canManage: boolean; enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string>("");
  const [newAppliesTo, setNewAppliesTo] = useState("both");
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editAppliesTo, setEditAppliesTo] = useState("both");

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

  const ordered = orderTree(groups);

  return (
    <div className="max-w-2xl space-y-4">
      <div className={`rounded-xl border px-4 py-3 text-[12.5px] ${enabled ? "border-[var(--color-accent-100)] bg-[var(--color-accent-50)] text-[var(--color-accent-700)]" : "border-[var(--color-ink-200)] bg-white text-[var(--color-ink-600)]"}`}>
        {enabled
          ? "Item groups are currently required for new items and any purchase line added into the Items list."
          : "Item groups are currently optional. You can build them here before turning the requirement on in Settings."}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className={input + " flex-1 min-w-[180px]"}
            placeholder="New group name, e.g. Electronics, Raw Materials, Services"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                run(async () => {
                  await createItemGroupAction(newName, newParentId ? Number(newParentId) : null, newAppliesTo);
                  setNewName("");
                  setNewParentId("");
                  setNewAppliesTo("both");
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
          <select className={input} value={newAppliesTo} onChange={(e) => setNewAppliesTo(e.target.value)}>
            <option value="both">All item types</option>
            {types.map((t) => (
              <option key={t.name} value={t.name}>{appliesToLabel(t.name)}</option>
            ))}
          </select>
          <button
            disabled={pending || !newName.trim()}
            onClick={() =>
              run(async () => {
                await createItemGroupAction(newName, newParentId ? Number(newParentId) : null, newAppliesTo);
                setNewName("");
                setNewParentId("");
                setNewAppliesTo("both");
              })
            }
            className="rounded-lg bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white text-[13px] font-medium px-4 py-2 whitespace-nowrap"
          >
            Add group
          </button>
        </div>
        <p className="text-[11.5px] text-[var(--color-ink-400)]">
          Pick a parent to make this a subgroup. "Products only"/"Services only" restricts which item type can use this group — leave as "Products & services" if it doesn't matter.
        </p>
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
                        <select className={input} value={editAppliesTo} onChange={(e) => setEditAppliesTo(e.target.value)}>
                          <option value="both">All item types</option>
                          {types.map((t) => (
                            <option key={t.name} value={t.name}>{appliesToLabel(t.name)}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">{depth > 0 ? "↳ " : ""}{g.name}</span>
                        {g.appliesTo !== "both" && (
                          <span className="ml-2 text-[11px] text-[var(--color-ink-400)]">{appliesToLabel(g.appliesTo)}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[var(--color-ink-400)] whitespace-nowrap">
                    {g.itemCount} item{g.itemCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {editing === g.id ? (
                      <>
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              await renameItemGroupAction(g.id, editName, editParentId ? Number(editParentId) : null, editAppliesTo);
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
                            setEditAppliesTo(g.appliesTo || "both");
                          }}
                          className="text-[var(--color-ink-500)] hover:text-[var(--color-ink-900)] mr-3"
                        >
                          Rename / move
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => {
                            if (confirm(g.itemCount > 0 ? `Delete "${g.name}"? Move its items to another group first.` : `Delete "${g.name}"? Any subgroups will move to top-level.`)) {
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
